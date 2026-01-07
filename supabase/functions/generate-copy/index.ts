import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SequenceStepInput {
  id: string;
  channel: string;
  stepType: string;
  delayDays: number;
}

interface GenerationRequest {
  sequenceSteps?: SequenceStepInput[];
  channel?: string;
  sequenceStep?: string;
  buyerName?: string;
  buyerWebsite?: string;
  targetIndustry?: string;
  painPoints?: string;
  emailGoal?: string;
  callTranscript?: string;
  documentPaths?: string[];
  tone: string;
  workspaceId: string;
  variationCount?: number;
}

interface BestPractice {
  channel: string;
  category: string;
  practice_type: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  performance_lift: number | null;
}

const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  linkedin_connection: 'LinkedIn Connection Request',
  linkedin_inmail: 'LinkedIn InMail',
  linkedin_message: 'LinkedIn Message',
  phone_cold_call: 'Cold Call Script',
  phone_voicemail: 'Voicemail Script',
  sms: 'SMS',
};

interface ChannelConstraint {
  hardLimit: { chars?: number; words?: number };
  idealRange: { min: number; max: number; unit: 'chars' | 'words' };
  subjectLimit?: { chars: number; idealRange: { min: number; max: number } };
  readingGrade?: { ideal: { min: number; max: number }; max: number };
  paragraphLimit?: number;
  notes: string;
}

const CHANNEL_CONSTRAINTS: Record<string, ChannelConstraint> = {
  email: {
    hardLimit: { words: 150 },
    idealRange: { min: 50, max: 125, unit: 'words' },
    subjectLimit: { chars: 78, idealRange: { min: 30, max: 50 } },
    readingGrade: { ideal: { min: 6, max: 8 }, max: 10 },
    paragraphLimit: 4,
    notes: 'Sweet spot 50-125 words. Subject 30-50 chars. 6th-8th grade reading level.'
  },
  linkedin_connection: {
    hardLimit: { chars: 300 },
    idealRange: { min: 200, max: 280, unit: 'chars' },
    notes: 'MUST be under 300 characters total. Be personal and brief.'
  },
  linkedin_inmail: {
    hardLimit: { words: 200 },
    idealRange: { min: 75, max: 150, unit: 'words' },
    subjectLimit: { chars: 200, idealRange: { min: 30, max: 60 } },
    notes: 'Keep under 150 words. Subject line important for open rates.'
  },
  linkedin_message: {
    hardLimit: { words: 100 },
    idealRange: { min: 40, max: 80, unit: 'words' },
    notes: 'Keep short and conversational. Already connected, be casual.'
  },
  phone_cold_call: {
    hardLimit: { words: 200 },
    idealRange: { min: 80, max: 150, unit: 'words' },
    notes: 'Script for 30-60 second call opening. Get to point quickly.'
  },
  phone_voicemail: {
    hardLimit: { words: 75 },
    idealRange: { min: 40, max: 60, unit: 'words' },
    notes: 'Keep under 30 seconds. Clear CTA and callback number.'
  },
  sms: {
    hardLimit: { chars: 160 },
    idealRange: { min: 100, max: 155, unit: 'chars' },
    notes: 'Standard SMS limit. No emojis, clear CTA.'
  },
};

// ============================================================================
// COLD EMAIL COPYWRITING GUIDE - EMBEDDED BEST PRACTICES
// ============================================================================

const SUBJECT_LINE_FRAMEWORKS = {
  referral: {
    name: 'Referral/Connection Frame',
    template: '{mutual_name} suggested I reach out',
    examples: ['Sarah mentioned you might be interested', 'Following up from {event}'],
    lift: '+30% open rate when genuine referral exists'
  },
  observation: {
    name: 'Observation Frame',
    template: 'Your latest {specific_thing}',
    examples: ['Your product launch', 'Noticed your Series B', 'Your recent hire for {role}'],
    lift: '+25% open rate - shows you did research'
  },
  question: {
    name: 'Question Frame',
    template: 'Quick question about {topic}?',
    examples: ['Quick question about your outbound strategy?', 'Thoughts on {their challenge}?'],
    lift: '+20% open rate - curiosity driver'
  },
  valueFirst: {
    name: 'Value-First Frame',
    template: 'Idea for {their challenge}',
    examples: ['Idea for your hiring pipeline', 'Thought for your Q2 growth'],
    lift: '+15% open rate - promises value'
  }
};

const SUBJECT_LINE_ANTI_PATTERNS = [
  'Just following up',
  'Hope you\'re doing well',
  'Partnership opportunity',
  'Can I pick your brain?',
  'Exciting opportunity',
  'I\'d love to chat',
  'Quick sync?',
  'Touching base',
  'Checking in',
  'Hope this email finds you well',
  'Wanted to connect',
  'Introduction',
  'Hello from {company}',
  'RE:', // fake reply threading
  'FWD:', // fake forward
];

const OPENING_LINE_STRATEGIES = {
  genuineObservation: {
    name: 'Genuine Observation',
    description: 'Reference something specific about their work that genuinely impressed you',
    examples: [
      'Your article on {topic} shifted how I think about {related_thing}.',
      'The way you\'ve positioned {their product} is brilliant - especially the {specific_aspect}.',
      'Saw your talk at {event} - your point about {topic} really stuck with me.'
    ]
  },
  relevantKnowledge: {
    name: 'Relevant Knowledge',
    description: 'Share an insight that positions you as knowledgeable about their space',
    examples: [
      'Companies at your stage typically struggle with {common_challenge}.',
      'Based on {public info}, it looks like you\'re focused on {goal}.',
      'Teams that just raised a Series B often face {specific challenge}.'
    ]
  },
  insightSharing: {
    name: 'Insight Sharing',
    description: 'Lead with something you learned that\'s relevant to them',
    examples: [
      'While researching {their industry}, I found that {insight}.',
      'Noticed a trend in {their space} that reminded me of {your expertise}.',
      'Just analyzed 50 companies like yours - one pattern stood out.'
    ]
  },
  triggerEvent: {
    name: 'Trigger Event',
    description: 'Reference a recent company event that creates relevance',
    examples: [
      'Congratulations on the recent funding - now comes the fun part.',
      'Saw the announcement about {expansion/hire/launch}.',
      'Your recent move into {market} caught my attention.'
    ]
  }
};

const OPENING_LINE_ANTI_PATTERNS = [
  'I hope this email finds you well',
  'My name is {name} and I work at {company}',
  'I\'m reaching out because...',
  'I know you\'re busy, but...',
  'You don\'t know me, but...',
  '{Company} is a leading provider of...',
  'I wanted to introduce myself',
  'We help companies like yours',
  'I noticed you\'re the {title} at {company}',
  'I\'ve been following your company',
  'I\'m sure you\'re getting a lot of emails',
  'Sorry for the cold email',
];

const CTA_FRAMEWORKS = {
  interestCheck: {
    name: 'Interest Check',
    description: 'Low-friction ask that gauges interest without commitment',
    examples: [
      'Is improving {specific outcome} a priority right now?',
      'Worth exploring?',
      'Does this resonate?',
      'Would this be helpful?'
    ],
    bestFor: 'First email, cold outreach'
  },
  permissionEscalation: {
    name: 'Permission-Based Escalation',
    description: 'Offer value before asking for time',
    examples: [
      'Happy to share how {similar company} approached this - interested?',
      'I put together a brief analysis - want me to send it over?',
      'Have a case study that might be relevant - should I share?'
    ],
    bestFor: 'When you have relevant content/proof'
  },
  specificNextStep: {
    name: 'Specific Next Step',
    description: 'Concrete ask with specific options - use sparingly on first touch',
    examples: [
      'Do you have 15 minutes Thursday or Friday?',
      'Free for a quick call this week?',
      'Can I show you a 5-minute demo?'
    ],
    bestFor: 'Follow-ups, warm leads, after interest is shown'
  },
  twoChoice: {
    name: 'Two-Choice Close',
    description: 'Give them control with bounded options',
    examples: [
      'I can either send a case study or we can chat - which works?',
      'Would you prefer I send details in email or walk you through it?'
    ],
    bestFor: 'When follow-up shows mild interest'
  }
};

const CTA_ANTI_PATTERNS = [
  'Let me know',
  'No worries if not',
  'Sorry for the cold email',
  'Feel free to reach out',
  'Hope to hear from you',
  'Looking forward to your response',
  'Let me know your thoughts',
  'Get back to me when you can',
  'Multiple CTAs in one email',
  'Asking for 30+ minute call on first touch',
];

const FOLLOW_UP_PRINCIPLES = {
  rules: [
    'Each follow-up MUST add new value - never "just checking in"',
    'Follow-ups should be SHORTER than the first email (2-4 sentences)',
    'Try a different angle each time',
    'Reference the previous email briefly but don\'t repeat it',
    'After 3-4 touches, consider a breakup email'
  ],
  angles: {
    newInsight: 'Share something you learned since last email',
    differentProblem: 'Pivot to a different pain point they might have',
    socialProof: 'Add a new case study or customer result',
    contentShare: 'Share relevant content (not sales material)',
    breakup: 'Final touch - acknowledge the silence, leave door open'
  }
};

const SPAM_WORDS = [
  'free', 'guarantee', 'no obligation', 'act now', 'limited time',
  'once in a lifetime', 'winner', 'congratulations', 'urgent',
  'click here', 'buy now', 'order now', 'subscribe', 'deal',
  '100%', 'amazing', 'incredible', 'revolutionary', 'exclusive offer',
  'risk free', 'no cost', 'lowest price', 'save big', 'bonus',
  'special promotion', 'one time offer', 'call now', 'don\'t miss',
  'limited spots', 'hurry', 'instant', 'secret', 'shocking',
];

// Calculate You:I ratio
function calculateYouIRatio(text: string): { ratio: number; youCount: number; iCount: number } {
  const lowerText = text.toLowerCase();
  // Count "you", "your", "yours", "yourself"
  const youMatches = lowerText.match(/\b(you|your|yours|yourself)\b/g) || [];
  // Count "I", "we", "our", "my", "myself", "ourselves"
  const iMatches = lowerText.match(/\b(i|we|our|my|myself|ourselves|me|us)\b/g) || [];
  
  const youCount = youMatches.length;
  const iCount = iMatches.length;
  const ratio = iCount === 0 ? youCount : youCount / iCount;
  
  return { ratio, youCount, iCount };
}

// Check if subject follows any approved framework
function checkSubjectFramework(subject: string): { matches: boolean; framework: string | null } {
  const lowerSubject = subject.toLowerCase();
  
  // Check for anti-patterns first
  for (const antiPattern of SUBJECT_LINE_ANTI_PATTERNS) {
    if (lowerSubject.includes(antiPattern.toLowerCase())) {
      return { matches: false, framework: null };
    }
  }
  
  // Check if it looks like a framework
  if (lowerSubject.includes('suggested') || lowerSubject.includes('mentioned')) {
    return { matches: true, framework: 'referral' };
  }
  if (lowerSubject.includes('your ') && (lowerSubject.includes('recent') || lowerSubject.includes('latest'))) {
    return { matches: true, framework: 'observation' };
  }
  if (lowerSubject.includes('?') && lowerSubject.length < 50) {
    return { matches: true, framework: 'question' };
  }
  if (lowerSubject.includes('idea for') || lowerSubject.includes('thought on')) {
    return { matches: true, framework: 'valueFirst' };
  }
  
  // If none match explicitly, check basic quality
  const isLowercase = subject === subject.toLowerCase() || subject.split(' ').filter(w => w[0] === w[0]?.toUpperCase() && w.length > 1).length <= 1;
  return { matches: isLowercase && subject.length < 60, framework: 'generic' };
}

// Check if opening line follows best practices
function checkOpeningLine(body: string): { valid: boolean; issue: string | null } {
  const firstSentence = body.split(/[.!?]/)[0].toLowerCase().trim();
  
  for (const antiPattern of OPENING_LINE_ANTI_PATTERNS) {
    const pattern = antiPattern.toLowerCase().replace(/{[^}]+}/g, '.*');
    if (new RegExp(pattern).test(firstSentence)) {
      return { valid: false, issue: `Opening matches anti-pattern: "${antiPattern}"` };
    }
  }
  
  // Check for self-focused opening
  const startsWithI = /^(i|my|we|our)\b/i.test(firstSentence);
  if (startsWithI) {
    return { valid: false, issue: 'Opening starts with "I/we/my/our" - should start with THEM' };
  }
  
  return { valid: true, issue: null };
}

// Check CTA quality
function checkCTA(body: string, isFirstTouch: boolean): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const lowerBody = body.toLowerCase();
  
  // Check for anti-patterns
  for (const antiPattern of CTA_ANTI_PATTERNS) {
    if (lowerBody.includes(antiPattern.toLowerCase())) {
      warnings.push(`CTA anti-pattern detected: "${antiPattern}"`);
    }
  }
  
  // Check for high-friction asks on first touch
  if (isFirstTouch) {
    if (lowerBody.includes('30 minute') || lowerBody.includes('hour call')) {
      warnings.push('Asking for long meeting on first touch - prefer low-friction CTA');
    }
    if (lowerBody.includes('demo') && lowerBody.includes('schedule')) {
      warnings.push('Asking for demo on first touch - prefer interest check first');
    }
  }
  
  // Check for multiple CTAs
  const ctaIndicators = ['?', 'let me know', 'would you', 'can we', 'want to', 'interested'];
  const ctaCount = ctaIndicators.filter(ind => lowerBody.includes(ind)).length;
  if (ctaCount > 2) {
    warnings.push('Possible multiple CTAs detected - stick to ONE clear ask');
  }
  
  return { valid: warnings.length === 0, warnings };
}

// Enhanced quality score with guide alignment
function calculateQualityScore(
  body: string,
  subjectLine: string | undefined,
  channel: string,
  patternsUsed: string[],
  isFirstTouch: boolean = true
): { 
  score: number; 
  breakdown: { 
    constraints: number; 
    patterns: number; 
    guideAlignment: number;
    spam: number; 
    readability: number;
    youIRatio: number;
  }; 
  issues: string[]; 
  warnings: string[];
} {
  const constraint = CHANNEL_CONSTRAINTS[channel];
  if (!constraint) {
    return { 
      score: 70, 
      breakdown: { constraints: 25, patterns: 15, guideAlignment: 10, spam: 10, readability: 5, youIRatio: 5 }, 
      issues: [], 
      warnings: [] 
    };
  }

  const issues: string[] = [];
  const warnings: string[] = [];
  
  // Scoring components (total 100)
  let constraintScore = 30; // 30 points max
  let patternScore = 0;      // 20 points max
  let guideAlignmentScore = 20; // 20 points max
  let spamScore = 10;        // 10 points max
  let readabilityScore = 10; // 10 points max
  let youIRatioScore = 10;   // 10 points max

  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const charCount = body.length;
  const subjectCharCount = subjectLine?.length || 0;

  // === CONSTRAINT SCORING (30 pts) ===
  if (constraint.hardLimit.words && wordCount > constraint.hardLimit.words) {
    constraintScore = 0;
    issues.push(`Exceeds ${constraint.hardLimit.words} word limit (${wordCount} words)`);
  } else if (constraint.hardLimit.chars && charCount > constraint.hardLimit.chars) {
    constraintScore = 0;
    issues.push(`Exceeds ${constraint.hardLimit.chars} char limit (${charCount} chars)`);
  } else {
    const unit = constraint.idealRange.unit;
    const value = unit === 'words' ? wordCount : charCount;
    const { min, max } = constraint.idealRange;

    if (value >= min && value <= max) {
      constraintScore = 30;
    } else if (value < min) {
      const deficit = (min - value) / min;
      constraintScore = Math.max(15, 30 - Math.floor(deficit * 15));
      warnings.push(`Below ideal ${unit} count (${value}/${min}-${max})`);
    } else {
      const excess = (value - max) / max;
      constraintScore = Math.max(10, 30 - Math.floor(excess * 20));
      warnings.push(`Above ideal ${unit} count (${value}/${min}-${max})`);
    }
  }

  // Subject line check
  if (constraint.subjectLimit && subjectLine) {
    if (subjectCharCount > constraint.subjectLimit.chars) {
      constraintScore = Math.max(0, constraintScore - 10);
      issues.push(`Subject exceeds ${constraint.subjectLimit.chars} char limit`);
    } else if (subjectCharCount < constraint.subjectLimit.idealRange.min) {
      warnings.push(`Subject below ideal length (${subjectCharCount}/${constraint.subjectLimit.idealRange.min}-${constraint.subjectLimit.idealRange.max})`);
      constraintScore = Math.max(0, constraintScore - 3);
    } else if (subjectCharCount > constraint.subjectLimit.idealRange.max) {
      warnings.push(`Subject above ideal length (${subjectCharCount}/${constraint.subjectLimit.idealRange.min}-${constraint.subjectLimit.idealRange.max})`);
      constraintScore = Math.max(0, constraintScore - 3);
    }
  }

  // === PATTERN SCORING (20 pts) ===
  patternScore = Math.min(20, patternsUsed.length * 7);

  // === GUIDE ALIGNMENT SCORING (20 pts) ===
  if (channel === 'email' && subjectLine) {
    // Subject framework check (+5 pts)
    const subjectCheck = checkSubjectFramework(subjectLine);
    if (subjectCheck.matches) {
      guideAlignmentScore += 0; // Already at 20
    } else {
      guideAlignmentScore -= 5;
      warnings.push('Subject line doesn\'t follow proven frameworks');
    }
    
    // Opening line check (+5 pts)
    const openingCheck = checkOpeningLine(body);
    if (!openingCheck.valid) {
      guideAlignmentScore -= 5;
      warnings.push(openingCheck.issue || 'Opening line needs improvement');
    }
    
    // CTA check (+5 pts)
    const ctaCheck = checkCTA(body, isFirstTouch);
    if (!ctaCheck.valid) {
      guideAlignmentScore -= 5;
      warnings.push(...ctaCheck.warnings.slice(0, 1));
    }
    
    // Paragraph structure check (+5 pts)
    const paragraphs = body.split(/\n\n+/).filter(p => p.trim());
    if (paragraphs.some(p => p.split(/[.!?]+/).filter(s => s.trim()).length > 3)) {
      guideAlignmentScore -= 3;
      warnings.push('Some paragraphs exceed 3 sentences');
    }
  }
  guideAlignmentScore = Math.max(0, guideAlignmentScore);

  // === SPAM SCORING (10 pts) ===
  const lowerBody = body.toLowerCase();
  const lowerSubject = (subjectLine || '').toLowerCase();
  const fullText = `${lowerSubject} ${lowerBody}`;
  
  let spamWordCount = 0;
  for (const word of SPAM_WORDS) {
    if (fullText.includes(word.toLowerCase())) {
      spamWordCount++;
    }
  }
  
  if (spamWordCount > 0) {
    spamScore = Math.max(0, 10 - spamWordCount * 3);
    if (spamWordCount >= 2) {
      warnings.push(`Contains ${spamWordCount} potential spam triggers`);
    }
  }

  // Check for excessive punctuation/caps
  const capsRatio = (body.match(/[A-Z]/g)?.length || 0) / Math.max(1, body.length);
  const exclamationCount = (body.match(/!/g)?.length || 0);
  if (capsRatio > 0.25) {
    spamScore = Math.max(0, spamScore - 3);
    warnings.push('Excessive capitalization detected');
  }
  if (exclamationCount > 1) {
    spamScore = Math.max(0, spamScore - 2);
    warnings.push('Multiple exclamation marks detected');
  }

  // === READABILITY SCORING (10 pts) ===
  const sentences = body.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const avgWordsPerSentence = wordCount / Math.max(1, sentences);
  
  if (constraint.readingGrade) {
    if (avgWordsPerSentence >= 8 && avgWordsPerSentence <= 18) {
      readabilityScore = 10;
    } else if (avgWordsPerSentence < 8) {
      readabilityScore = 8;
    } else if (avgWordsPerSentence <= 22) {
      readabilityScore = 6;
      warnings.push('Sentences may be too long');
    } else {
      readabilityScore = 3;
      warnings.push('Very long sentences - consider breaking up');
    }
  }

  // === YOU:I RATIO SCORING (10 pts) ===
  const { ratio, youCount, iCount } = calculateYouIRatio(body);
  if (ratio >= 2) {
    youIRatioScore = 10;
  } else if (ratio >= 1.5) {
    youIRatioScore = 8;
  } else if (ratio >= 1) {
    youIRatioScore = 6;
    warnings.push(`You:I ratio is ${ratio.toFixed(1)}:1 - aim for 2:1 or higher`);
  } else {
    youIRatioScore = 3;
    warnings.push(`Too self-focused (You:I = ${ratio.toFixed(1)}:1) - focus more on them`);
  }

  const totalScore = constraintScore + patternScore + guideAlignmentScore + spamScore + readabilityScore + youIRatioScore;

  return {
    score: Math.min(100, totalScore),
    breakdown: {
      constraints: constraintScore,
      patterns: patternScore,
      guideAlignment: guideAlignmentScore,
      spam: spamScore,
      readability: readabilityScore,
      youIRatio: youIRatioScore
    },
    issues,
    warnings
  };
}

// Build the tiered prompt based on available data
function buildTieredPrompt(
  steps: SequenceStepInput[],
  context: {
    buyerName?: string;
    buyerWebsite?: string;
    targetIndustry?: string;
    painPoints?: string;
    emailGoal?: string;
    tone: string;
    callTranscript?: string;
  },
  workspaceData: {
    winningPatterns: Array<{ pattern_name: string; pattern_description: string | null; reply_rate_lift: number | null }> | null;
    topCopy: Array<{ subject_line: string | null; body_preview: string | null; positive_reply_rate: number | null }> | null;
    groupedIntel: Record<string, Array<{ content: string; context: string | null }>>;
  },
  variationCount: number
): string {
  const hasWorkspaceData = (workspaceData.winningPatterns?.length || 0) > 0 || (workspaceData.topCopy?.length || 0) > 0;
  
  // Build step descriptions with constraints
  const stepsDescription = steps.map((step, idx) => {
    const channelLabel = CHANNEL_LABELS[step.channel] || step.channel;
    const constraint = CHANNEL_CONSTRAINTS[step.channel];
    let constraintInfo = '';
    if (constraint) {
      if (constraint.hardLimit.chars) {
        constraintInfo = `HARD LIMIT: ${constraint.hardLimit.chars} chars. Sweet spot: ${constraint.idealRange.min}-${constraint.idealRange.max} chars.`;
      } else if (constraint.hardLimit.words) {
        constraintInfo = `HARD LIMIT: ${constraint.hardLimit.words} words. Sweet spot: ${constraint.idealRange.min}-${constraint.idealRange.max} words.`;
      }
      if (constraint.subjectLimit) {
        constraintInfo += ` Subject: ${constraint.subjectLimit.idealRange.min}-${constraint.subjectLimit.idealRange.max} chars ideal.`;
      }
    }
    const isFirstTouch = idx === 0;
    return `
Step ${idx + 1}: ${channelLabel} ${isFirstTouch ? '(FIRST TOUCH)' : '(FOLLOW-UP)'}
- ${constraintInfo}
- ${constraint?.notes || ''}
- ${isFirstTouch ? 'Use LOW-FRICTION CTA (interest check, not meeting request)' : 'Can be more direct but add NEW value'}`;
  }).join('\n');

  // ==================== TIER 1: UNIVERSAL BEST PRACTICES ====================
  const tier1 = `
## TIER 1: UNIVERSAL BEST PRACTICES (ALWAYS FOLLOW - THIS IS YOUR FOUNDATION)

### SUBJECT LINE RULES:
1. Keep under 50 characters ideal, 78 absolute max
2. Use lowercase or sentence case ONLY (never Title Case Every Word)
3. Front-load important words (mobile truncates at 30-40 chars)
4. Use one of these PROVEN frameworks:
   - **Referral Frame**: "{name} suggested I reach out" or "Following up from {event}"
   - **Observation Frame**: "Your recent {specific thing}" or "Noticed your {announcement}"
   - **Question Frame**: "Quick question about {topic}?" (keep short)
   - **Value-First Frame**: "Idea for {their challenge}" or "Thought on {their goal}"
5. NEVER use these (they get ignored/flagged):
   ${SUBJECT_LINE_ANTI_PATTERNS.slice(0, 8).map(p => `"${p}"`).join(', ')}

### OPENING LINE RULES:
1. NEVER start with yourself - no "My name is...", "I'm reaching out...", "I/We help..."
2. Start with THEM - their work, their challenges, their achievements
3. Use one of these PROVEN strategies:
   - **Genuine Observation**: "Your article on {topic} shifted how I think about..."
   - **Relevant Knowledge**: "Companies at your stage typically struggle with..."
   - **Insight Sharing**: "While researching {their space}, I found that..."
   - **Trigger Event**: "Congratulations on the recent {news}..."
4. NEVER use these openers:
   ${OPENING_LINE_ANTI_PATTERNS.slice(0, 6).map(p => `"${p}"`).join(', ')}

### BODY COPY RULES:
1. **50-125 words is the sweet spot** - no one reads walls of text
2. **Short paragraphs** - 2-3 sentences MAX per paragraph
3. **Focus on THEM, not you** - aim for 2:1 "you/your" to "I/we" ratio
4. **Show, don't tell** - use specific results, not vague claims
   - BAD: "We help companies grow"
   - GOOD: "We helped {similar company} increase {metric} by {number}"
5. **Simple language** - write at 6th-8th grade reading level
6. **NO spam triggers**: ${SPAM_WORDS.slice(0, 10).join(', ')}

### CTA RULES:
1. **ONE CTA per email** - never multiple asks
2. **First touch = Low friction**:
   - "Is improving {X} a priority right now?"
   - "Worth exploring?"
   - "Does this resonate?"
3. **Avoid on first touch**: "Let's schedule a call", "30-minute meeting", "demo"
4. **NEVER use**:
   - "Let me know"
   - "No worries if not"
   - "Hope to hear from you"
   - "Feel free to reach out"

### FOLLOW-UP RULES (for Step 2+):
1. Each follow-up MUST add NEW value - never "just checking in" or "bumping this up"
2. Follow-ups should be SHORTER (2-4 sentences)
3. Try a DIFFERENT angle each time:
   - New insight you learned
   - Different pain point
   - New social proof/case study
   - Breakup email (last touch)
4. Reference previous email briefly, don't repeat it

### TONE GUIDELINES:
- Sound like a helpful peer, not a sales robot
- Be specific, not vague
- Be confident, not desperate
- Be curious, not presumptuous
`;

  // ==================== TIER 2: WORKSPACE LEARNINGS ====================
  let tier2 = '\n## TIER 2: YOUR WORKSPACE\'S PROVEN PATTERNS\n';
  
  if (workspaceData.winningPatterns?.length) {
    tier2 += '\n### WINNING PATTERNS FROM YOUR DATA:\n';
    tier2 += 'These patterns have been VALIDATED from your actual campaign performance:\n';
    workspaceData.winningPatterns.forEach(p => {
      tier2 += `- **${p.pattern_name}**: ${p.pattern_description || ''} → +${((p.reply_rate_lift || 0) * 100).toFixed(0)}% lift\n`;
    });
    tier2 += '\n*Incorporate these patterns - they work for YOUR audience.*\n';
  }
  
  if (workspaceData.topCopy?.length) {
    tier2 += '\n### YOUR TOP PERFORMING COPY:\n';
    tier2 += 'These actual emails got the best results:\n';
    workspaceData.topCopy.forEach((c, i) => {
      tier2 += `${i + 1}. "${c.subject_line || 'N/A'}" → ${((c.positive_reply_rate || 0) * 100).toFixed(1)}% positive rate\n`;
    });
    tier2 += '\n*Mirror the structure and tone of these winners.*\n';
  }
  
  if (Object.keys(workspaceData.groupedIntel).length > 0) {
    tier2 += '\n### EXTRACTED INDUSTRY INTELLIGENCE:\n';
    
    if (workspaceData.groupedIntel['pain_point']?.length) {
      tier2 += '\n**PAIN POINTS** (use these exact phrases when relevant):\n';
      workspaceData.groupedIntel['pain_point'].slice(0, 5).forEach(p => {
        tier2 += `- "${p.content}"\n`;
      });
    }
    
    if (workspaceData.groupedIntel['terminology']?.length) {
      tier2 += '\n**INDUSTRY TERMINOLOGY** (use naturally):\n';
      workspaceData.groupedIntel['terminology'].slice(0, 5).forEach(t => {
        tier2 += `- ${t.content}\n`;
      });
    }
    
    if (workspaceData.groupedIntel['buying_trigger']?.length) {
      tier2 += '\n**BUYING TRIGGERS** (reference when applicable):\n';
      workspaceData.groupedIntel['buying_trigger'].slice(0, 3).forEach(b => {
        tier2 += `- ${b.content}\n`;
      });
    }
    
    if (workspaceData.groupedIntel['objection']?.length) {
      tier2 += '\n**COMMON OBJECTIONS** (preemptively address):\n';
      workspaceData.groupedIntel['objection'].slice(0, 3).forEach(o => {
        tier2 += `- ${o.content}\n`;
      });
    }
    
    if (workspaceData.groupedIntel['language_pattern']?.length) {
      tier2 += '\n**LANGUAGE PATTERNS** (mirror this style):\n';
      workspaceData.groupedIntel['language_pattern'].slice(0, 3).forEach(l => {
        tier2 += `- "${l.content}"\n`;
      });
    }
  }
  
  if (!hasWorkspaceData && Object.keys(workspaceData.groupedIntel).length === 0) {
    tier2 += '\n*No workspace-specific patterns yet - relying heavily on Tier 1 best practices.*\n';
  }

  // ==================== TIER 3: CAMPAIGN CONTEXT ====================
  const tier3 = `
## TIER 3: CAMPAIGN CONTEXT (PERSONALIZE TO THIS)

- **Target Company**: ${context.buyerName || 'Not specified'}
- **Website**: ${context.buyerWebsite || 'Not specified'}
- **Industry**: ${context.targetIndustry || 'Not specified'}
- **Pain Points**: ${context.painPoints || 'Not specified'}
- **Goal**: ${context.emailGoal || 'Book a meeting'}
- **Tone**: ${context.tone || 'conversational'}

${context.callTranscript ? `
### CALL TRANSCRIPT INSIGHTS:
Extract and use language patterns, objections, and pain points from this call:
${context.callTranscript.substring(0, 2000)}
` : ''}
`;

  // ==================== GENERATION INSTRUCTIONS ====================
  const instructions = `
## SEQUENCE TO GENERATE (${steps.length} steps, ${variationCount} variations each):
${stepsDescription}

## GENERATION REQUIREMENTS:
1. Generate **${variationCount} distinct variations** for EACH step
2. Each variation must use a **DIFFERENT hook/angle**
3. Use personalization variables: {first_name}, {company}, {title}, {industry}
4. **STRICTLY respect all character/word limits** - COUNT CAREFULLY
5. Sound like a **real human**, not AI - no corporate speak
6. For email: provide both subject_line AND body
7. For LinkedIn connection: MUST be under 300 chars total
8. For SMS: MUST be under 160 chars total
9. End each message with **ONE clear, low-friction CTA** (especially on first touch)
10. **VALIDATE BEFORE OUTPUT**:
    - Subject follows one of the 4 frameworks?
    - Opening is about THEM, not you?
    - Body is 50-125 words?
    - You:I ratio is 2:1 or better?
    - Single, low-friction CTA?
    - No spam words?
`;

  return tier1 + tier2 + tier3 + instructions;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: GenerationRequest = await req.json();
    const { 
      sequenceSteps,
      channel,
      sequenceStep,
      buyerName,
      buyerWebsite,
      targetIndustry, 
      painPoints,
      emailGoal,
      callTranscript,
      tone, 
      workspaceId,
      variationCount = 2
    } = request;

    const steps: SequenceStepInput[] = sequenceSteps?.length 
      ? sequenceSteps 
      : channel && sequenceStep 
        ? [{ id: 'single', channel, stepType: sequenceStep, delayDays: 0 }]
        : [];

    if (!steps.length || !workspaceId) {
      return new Response(
        JSON.stringify({ error: 'At least one step and workspaceId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const uniqueChannels = [...new Set(steps.map(s => s.channel))];

    // Fetch winning patterns from workspace
    const { data: winningPatterns } = await supabase
      .from('copy_patterns')
      .select('pattern_name, pattern_description, pattern_criteria, reply_rate_lift, positive_rate_lift, sample_size, confidence_level')
      .eq('workspace_id', workspaceId)
      .eq('is_validated', true)
      .order('positive_rate_lift', { ascending: false })
      .limit(5);

    // Fetch top performing copy
    const { data: topCopy } = await supabase
      .from('copy_performance')
      .select('subject_line, body_preview, reply_rate, positive_reply_rate, total_sent')
      .eq('workspace_id', workspaceId)
      .gt('total_sent', 100)
      .order('positive_reply_rate', { ascending: false })
      .limit(5);

    // Fetch industry intelligence
    const { data: industryIntel } = await supabase
      .from('industry_intelligence')
      .select('intel_type, content, context')
      .or(`is_global.eq.true,workspace_id.eq.${workspaceId}`)
      .eq('industry', targetIndustry || 'general')
      .limit(30);

    // Group industry intel by type
    const groupedIntel: Record<string, Array<{ content: string; context: string | null }>> = {};
    if (industryIntel?.length) {
      for (const item of industryIntel) {
        if (!groupedIntel[item.intel_type]) {
          groupedIntel[item.intel_type] = [];
        }
        groupedIntel[item.intel_type].push({ content: item.content, context: item.context });
      }
    }

    // Build the tiered prompt
    const prompt = buildTieredPrompt(
      steps,
      { buyerName, buyerWebsite, targetIndustry, painPoints, emailGoal, tone, callTranscript },
      { winningPatterns, topCopy, groupedIntel },
      variationCount
    );

    console.log(`Generating sequence with ${steps.length} steps, ${variationCount} variations each`);
    console.log(`Workspace data: ${winningPatterns?.length || 0} patterns, ${topCopy?.length || 0} top copy examples, ${industryIntel?.length || 0} intel items`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an elite cold outreach copywriter who has studied the best practices from thousands of successful campaigns. You ALWAYS follow proven frameworks and NEVER use generic, robotic language. Every word counts.

Your copy is:
- Human and conversational (sounds like a real person, not a sales robot)
- Buyer-focused (about THEM, not you)
- Specific and concrete (real examples, not vague claims)
- Short and punchy (every word earns its place)
- Framework-driven (using proven structures that work)

You NEVER:
- Start with "I" or "We" 
- Use corporate buzzwords
- Write long paragraphs
- Include multiple CTAs
- Use spam trigger words
- Sound desperate or pushy

Output only valid JSON matching the requested schema.`
          },
          { role: 'user', content: prompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'generate_sequence',
              description: 'Generate a multi-step outreach sequence with variations following best practices',
              parameters: {
                type: 'object',
                properties: {
                  steps: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        step_index: { type: 'number', description: '0-indexed step number' },
                        channel: { type: 'string' },
                        step_type: { type: 'string' },
                        delay_days: { type: 'number' },
                        variations: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              subject_line: { type: 'string', description: 'Subject line for email, opening line for other channels' },
                              body: { type: 'string', description: 'Full message body' },
                              patterns_used: { 
                                type: 'array', 
                                items: { type: 'string' },
                                description: 'List of best practice patterns applied'
                              },
                              variation_style: { type: 'string', description: 'Brief description of this variation\'s angle' }
                            },
                            required: ['subject_line', 'body', 'patterns_used', 'variation_style'],
                            additionalProperties: false
                          }
                        }
                      },
                      required: ['step_index', 'channel', 'step_type', 'delay_days', 'variations'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['steps'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'generate_sequence' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Credits depleted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received');

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error('No tool call response from AI');
    }

    const result = JSON.parse(toolCall.function.arguments);

    // Validate and score each step's variations with enhanced scoring
    const validatedSteps = result.steps.map((step: Record<string, unknown>, stepIdx: number) => {
      const originalStep = steps[stepIdx];
      const isFirstTouch = stepIdx === 0;
      
      const validatedVariations = ((step.variations as Array<Record<string, unknown>>) || []).map((v, vIdx) => {
        const body = (v.body as string) || '';
        const subjectLine = v.subject_line as string | undefined;
        const patternsUsed = (v.patterns_used as string[]) || [];
        const wordCount = body.split(/\s+/).filter(Boolean).length;
        const charCount = body.length;
        const { ratio: youIRatio } = calculateYouIRatio(body);

        // Calculate enhanced quality score
        const scoring = calculateQualityScore(body, subjectLine, originalStep?.channel || '', patternsUsed, isFirstTouch);

        return {
          index: vIdx,
          subject_line: subjectLine,
          body,
          patterns_used: patternsUsed,
          quality_score: scoring.score,
          quality_breakdown: scoring.breakdown,
          word_count: wordCount,
          char_count: charCount,
          you_i_ratio: youIRatio,
          variation_style: v.variation_style || `Variation ${vIdx + 1}`,
          validation: {
            is_valid: scoring.issues.length === 0,
            issues: scoring.issues,
            warnings: scoring.warnings
          }
        };
      });

      return {
        stepIndex: stepIdx,
        channel: originalStep?.channel || step.channel,
        stepType: originalStep?.stepType || step.step_type,
        delayDays: originalStep?.delayDays ?? step.delay_days ?? 0,
        variations: validatedVariations
      };
    });

    return new Response(
      JSON.stringify({ 
        steps: validatedSteps,
        context_used: {
          best_practices_count: 1, // We now have embedded guide
          winning_patterns_count: winningPatterns?.length || 0,
          top_copy_count: topCopy?.length || 0,
          industry_intel_count: industryIntel?.length || 0
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating copy:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
