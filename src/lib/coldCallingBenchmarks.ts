/**
 * INDUSTRY BENCHMARKS - NOT USER DATA
 * 
 * State of Cold Calling 2025 - Industry Benchmarks and Best Practices
 * Based on published research and analysis of 10M+ calls across the industry.
 * 
 * These values are used for COMPARISON purposes only - they represent
 * industry-wide standards, not fake performance data or sample metrics.
 * All actual user performance data comes from the database.
 */

export const COLD_CALLING_BENCHMARKS = {
  // Core Success Metrics
  successRates: {
    averageSuccessRate: 2.3, // % - down from 4.82% in 2024
    topPerformerRate: 6.7, // % - 3x average
    goodConversationToMeetingRate: { min: 4, max: 5 }, // %
    b2bColdCallingROIBoost: { min: 40, max: 50 }, // %
    coldCallsResultingInSales: 2, // %
  },

  // Reach & Connection
  reachMetrics: {
    attemptsToReachProspect: 8, // average calls needed
    callsToBookOneMeeting: 200, // at average rates
    connectRateBenchmark: { min: 25, max: 35 }, // % - below 20% = data problem
    qualityConversationsPerDay: 3.6, // down 55% since 2014
    prospectsAnsweringUnknownCalls: 32, // %
    conversationsBy3rdCall: 93, // %
    conversationsBy5thCall: 98, // %
  },

  // Buyer Behavior
  buyerBehavior: {
    buyersAcceptingMeetings: 82, // %
    cLevelPreferringPhone: 57, // %
    buyersTakingColdCalls: 69, // %
    prospectsNoBeforeYes: 4, // times (80% say no 4+ times)
    clientsBelievingSalespeopleUnderstand: 13, // % only
  },

  // Persistence Statistics
  persistence: {
    salespeopleReaching5thFollowup: 8, // % only
    followUpCallsNeeded: 5, // additional after initial
    contactRateBoostFrom6PlusCalls: 70, // % increase
    prospectsRespondingTo2nd3rdCall: 70, // %
    closeRateDropWithoutFollowup: 71, // %
    salespeopleGivingUpAfterOneAttempt: 44, // %
  },

  // Call Duration
  callDuration: {
    averageColdCallDuration: 93, // seconds
    optimalCallLengthMin: 3, // minutes
    optimalCallLengthMax: 5, // minutes
    repTalkTimeOptimal: 55, // % max - should talk LESS than this
    questionsFor70PercentSuccess: { min: 11, max: 14 },
  },

  // Data Quality
  dataQuality: {
    phoneVerifiedAccuracy: 87, // %
    aiVerifiedAccuracy: 98, // %
    organizationsWithIncompleteData: 62, // % have 20-40% incomplete
    repTimeWastedOnBadData: 27.3, // %
    b2bDataDecayRateMonthly: 2, // %
    b2bDataDecayRateAnnually: 22.5, // %
    costOfBadDataUS: 611, // billion dollars annually
    revenueLostToInaccurateData: 12, // %
    poorDataQualityCostPerBusiness: 12.9, // million dollars/year
  },

  // Regional Success Rates
  regionalRates: {
    uk: 8, // % - highest globally
    us: 6, // %
    europe: 6, // %
    scandinavia: 'variable', // shorter, more direct calls preferred
  },

  // SDR Metrics
  sdrMetrics: {
    dialsPerDay: { min: 60, max: 100 },
    emailsSentPerDay: { min: 50, max: 100 },
    linkedInTouchesPerDay: { min: 20, max: 30 },
    meetingsBookedPerMonthAvg: 15, // with 80% show rate = 12 held
    meetingsBookedPerMonthTop: 21, // 62% conversion rate
    meetingShowRate: 80, // %
    bookRateNewer: 25, // % meetings per conversation
    bookRateExperienced: 33, // %
    dialsPerMeeting: 100, // at average rates
    leadToOpportunityConversion: 52.7, // % SAL to SQL
    pipelineGeneratedPerSDR: 3000000, // $ median annually
    sdrContributionToPipeline: { min: 30, max: 45 }, // %
    timeActuallySelling: 28, // % of total work week
    sdrToAERatio: 2.6, // 1 SDR : 2.6 AEs
    leadResponseTimeTarget: 1, // hour - 8x decrease after first hour
    leadResponseTimeActual: 47, // hours - major opportunity
  },

  // AI Impact
  aiImpact: {
    efficiencyImprovement: 50, // %
    companiesImplementingAI: 75, // % by end of 2025
    conversationsIncreaseWithAI: 5, // x more daily
    connectRateImproveWithAI: 60, // % improvement
    teamsUsingAICRMExceedGoals: 83, // % more likely
  },

  // Multi-Channel
  multiChannel: {
    conversionBoost: 37, // % more conversions
    optimalSequenceDays: 10,
  },
};

export const OPTIMAL_TIMING = {
  // Best Days
  days: {
    tuesday: { rank: 1, label: 'Best', successRate: { min: 22, max: 24 }, notes: 'Highest booking rates, prospects settled in' },
    wednesday: { rank: 2, label: 'Second', successRate: { min: 21, max: 23 }, notes: 'Mid-week sweet spot, fewer meetings' },
    thursday: { rank: 3, label: 'Third', successRate: { min: 20, max: 22 }, notes: 'Best for meetings booked vs conversations' },
    monday: { rank: 4, label: 'Avoid', successRate: { min: 17, max: 19 }, notes: 'Catching up from weekend, lower receptivity' },
    friday: { rank: 5, label: 'Worst', successRate: { min: 15, max: 17 }, notes: 'Weekend mindset, early checkouts' },
  },

  // Best Times
  times: {
    '10-11 AM': { rating: 'Best', connectRateBoost: 30, notes: 'Morning tasks done, before lunch, mental space' },
    '4-5 PM': { rating: 'Excellent', connectRateBoost: 71, notes: 'Wrapping up day, more relaxed (vs noon)' },
    '8-10 AM': { rating: 'Good', successRate: 24, notes: 'Start of day, before meetings pile up' },
    '2-3 PM': { rating: 'Good', notes: 'Post-lunch energy recovery' },
    '11 AM-12 PM': { rating: 'Avoid', notes: 'Pre-lunch rush, drop off' },
    '12-1 PM': { rating: 'Worst', notes: 'Lunch hour—intrusive' },
    'After 5 PM': { rating: 'Avoid', notes: 'Personal time—damages rapport' },
  },

  // Connect Rate Heatmap (based on 187,684+ calls)
  heatmap: {
    peakSlot: 'Tuesday 10 AM - 18%',
    mondayMorningPeak: 30.4, // % - highest single-slot
    bestWindow: '8-11 AM consistently outperforms all other time slots',
    recommendation: 'Prioritize Tuesday-Thursday, 10-11 AM and 4-5 PM',
  },
};

export const GATEKEEPER_BENCHMARKS = {
  outcomes: {
    transferred: { rate: 37, description: 'Best outcome—direct access' },
    callbackScheduled: { rate: 22, description: 'Good—specific time secured' },
    messageTaken: { rate: 18, description: 'Okay—but low follow-through' },
    blocked: { rate: 23, description: 'Try different approach next time' },
  },

  techniques: {
    triggerBased: { getThroughRate: 48, example: 'I noticed [trigger]...' },
    referralMention: { getThroughRate: 52, example: '[Name] suggested I reach out...' },
    nameDrop: { getThroughRate: 41, example: 'Following up with [Owner]...' },
    directAsk: { getThroughRate: 28, example: 'Is [Owner] available?' },
  },

  whatIsThisRegarding: {
    recentExpansion: { getThroughRate: 52, example: "I'm calling about your recent expansion into [market]..." },
    sentInformation: { getThroughRate: 44, example: 'I sent [Owner] some information last week...' },
    businessMatter: { getThroughRate: 38, example: "It's regarding a business matter for [Owner]..." },
    followingUpCorrespondence: { getThroughRate: 41, example: "I'm following up on our correspondence..." },
  },
};

export const OBJECTION_HANDLING = {
  impactOnCloseRate: 64, // % close rate when handled successfully
  timing: 'Most objections appear in first 30-60 seconds',

  aceFramework: {
    acknowledge: { action: 'Validate their concern without agreeing', example: 'I completely understand...' },
    clarify: { action: 'Dig deeper to find the real issue', example: 'Can you help me understand...' },
    engage: { action: 'Address with value, not argument', example: "What I've found is..." },
  },

  topObjections: [
    {
      objection: "I don't have time to talk",
      response: "I get it—you're busy, and I caught you out of the blue. Is there a better time for a quick 3-minute call? I promise you'll know within 2 minutes if this is worth your time.",
    },
    {
      objection: "I'm not interested",
      response: 'I appreciate your honesty. Many of our clients initially felt the same way until they learned how [specific benefit] helped them [share quick success story]. Would 2 minutes change your mind?',
    },
    {
      objection: 'Just send me some information',
      response: "Happy to—but so I send you something actually relevant, can I ask a quick question? [Discovery question]. That way I won't waste your time with generic materials.",
    },
    {
      objection: 'We already have a solution',
      response: 'That makes sense. Most of our clients came to us while using [competitor]. Out of curiosity, what would need to change for you to consider an alternative?',
    },
    {
      objection: 'How did you get my number?',
      response: 'We research growing companies in [industry], and your profile came up as someone who might benefit from [value]. Is [challenge] something you\'re currently dealing with?',
    },
    {
      objection: "We don't have the budget",
      response: "I understand budget is always a consideration. Can you tell me—if pricing weren't an issue, would this be something you'd consider? [If yes] Let's explore what the ROI might look like...",
    },
    {
      objection: 'Call me back in a month',
      response: "Absolutely—I'll mark my calendar. Before I go, could you share who else might be involved in this decision? Would it help if I joined that conversation when we reconnect?",
    },
    {
      objection: 'I need to talk to my team',
      response: 'Of course. What aspects do you think they\'ll be most interested in? Would it make sense for me to join that conversation to answer any technical questions?',
    },
    {
      objection: 'Your price is too high',
      response: "I hear you. Let me ask—when you say too high, is that compared to your current solution, your budget, or something else? [Listen] Here's what our clients typically see in terms of return...",
    },
    {
      objection: "I'm happy with things as they are",
      response: "That's great to hear. Most of our clients felt the same way until they realized they were spending more time on [pain point] than they thought. Out of curiosity, how are you currently handling [specific challenge]?",
    },
  ],
};

export const CALL_STRUCTURE = {
  phases: [
    { phase: 'Opening', duration: '5-10 sec', goal: 'Pattern interrupt, earn 30 more seconds', elements: 'Name, company, trigger/hook' },
    { phase: 'Bridge', duration: '10-15 sec', goal: 'Establish relevance', elements: 'Why calling them specifically' },
    { phase: 'Qualifying', duration: '60-90 sec', goal: 'Understand their situation', elements: '11-14 open-ended questions' },
    { phase: 'Value Prop', duration: '30-45 sec', goal: 'Connect solution to their pain', elements: 'Specific benefits, social proof' },
    { phase: 'Close', duration: '15-30 sec', goal: 'Secure commitment', elements: 'Clear next step, calendar invite' },
  ],

  openingTypes: {
    triggerBased: { getThroughRate: 48, template: 'Hi [Name], I noticed [specific trigger—news, expansion, job posting] and thought it might be worth a quick conversation about [relevant benefit].' },
    permissionBased: { template: "Hi [Name], this is [Your Name] from [Company]. I know I'm catching you out of the blue—do you have 30 seconds for me to tell you why I'm calling, and then you can decide if we should keep talking?" },
    problemLed: { template: 'Hi [Name], I work with [similar companies/roles] who were struggling with [specific problem]. Is that something on your radar right now?' },
    referral: { getThroughRate: 52, template: 'Hi [Name], [Mutual connection] suggested I reach out. They mentioned you might be dealing with [challenge]—is that accurate?' },
  },

  openingsToAvoid: [
    'How are you today?',
    'Is this a good time?',
    'I hope I\'m not interrupting',
    'Do you have a minute?',
  ],
};

export const TRENDS_2025 = [
  {
    trend: 'AI Becomes Table Stakes',
    detail: 'By end of 2025, 75% of B2B companies will have implemented AI for cold calling. Teams without AI tools will fall further behind.',
  },
  {
    trend: 'Quality Over Quantity Accelerates',
    detail: 'Success rates compressed from 4.82% (2024) to 2.3% (2025). Only precision-targeted, well-researched outreach breaks through.',
  },
  {
    trend: 'Multi-Channel Becomes Mandatory',
    detail: 'Single-channel cold calling is dying. The 37% conversion boost from multi-channel approaches is now the minimum expectation.',
  },
  {
    trend: 'Real-Time Coaching Goes Mainstream',
    detail: 'AI-powered live coaching during calls—prompting reps on objection handling, questions, and information—becomes standard.',
  },
  {
    trend: 'Compliance Gets Stricter',
    detail: 'The 2025 TCPA changes (one-to-one consent, new opt-out rules) signal increased regulatory scrutiny.',
  },
  {
    trend: 'Human Connection Premium',
    detail: 'As AI handles mechanical work, the human element—empathy, rapport, genuine conversation—becomes the key differentiator.',
  },
];

export const KEY_TAKEAWAYS = [
  'Invest in quality data—bad data costs more than good data',
  'Embrace AI tools for efficiency, but keep human connection at the center',
  'Call at optimal times (Tue-Thu, 10-11 AM and 4-5 PM)',
  'Persist—it takes 8 attempts, and 80% of prospects say no 4+ times before yes',
  'Master objection handling—it can lift close rates to 64%',
  'Use multi-channel sequences for 37% more conversions',
  'Stay compliant—TCPA penalties can reach billions in class actions',
  'Measure what matters—focus on outcomes (meetings, pipeline), not just activity',
];

// Helper function to get benchmark comparison
export function compareToBenchmark(metric: string, value: number): {
  status: 'above' | 'at' | 'below';
  benchmark: number | { min: number; max: number };
  percentFromBenchmark: number;
} {
  const benchmarks: Record<string, number | { min: number; max: number }> = {
    connectRate: COLD_CALLING_BENCHMARKS.reachMetrics.connectRateBenchmark,
    conversationToMeetingRate: COLD_CALLING_BENCHMARKS.successRates.goodConversationToMeetingRate,
    meetingShowRate: COLD_CALLING_BENCHMARKS.sdrMetrics.meetingShowRate,
    qualityConversationsPerDay: COLD_CALLING_BENCHMARKS.reachMetrics.qualityConversationsPerDay,
    dialsPerDay: COLD_CALLING_BENCHMARKS.sdrMetrics.dialsPerDay,
    bookRate: COLD_CALLING_BENCHMARKS.sdrMetrics.bookRateExperienced,
    repTalkTime: COLD_CALLING_BENCHMARKS.callDuration.repTalkTimeOptimal,
  };

  const benchmark = benchmarks[metric];
  if (!benchmark) return { status: 'at', benchmark: 0, percentFromBenchmark: 0 };

  if (typeof benchmark === 'number') {
    const diff = ((value - benchmark) / benchmark) * 100;
    return {
      status: value > benchmark * 1.1 ? 'above' : value < benchmark * 0.9 ? 'below' : 'at',
      benchmark,
      percentFromBenchmark: diff,
    };
  }

  const midpoint = (benchmark.min + benchmark.max) / 2;
  const diff = ((value - midpoint) / midpoint) * 100;
  return {
    status: value > benchmark.max ? 'above' : value < benchmark.min ? 'below' : 'at',
    benchmark,
    percentFromBenchmark: diff,
  };
}

// AI Summary context for prompts
export function getAISummaryContext(): string {
  return `
You are an AI cold calling performance analyst with expertise in 2025 industry benchmarks based on analysis of 10M+ calls.

KEY 2025 BENCHMARKS:
- Average success rate: 2.3% (down from 4.82% in 2024)
- Top performers achieve: 6.7% (3x average)
- Connect rate benchmark: 25-35% (below 20% = data problem)
- Quality conversations per day: 3.6 average
- It takes 8 attempts to reach a prospect
- 82% of buyers accept meetings from strategic cold calls
- 57% of C-level executives prefer phone contact
- Optimal call length: 3-5 minutes
- Rep should talk less than 55% of call time
- Ask 11-14 questions for 70% success rate
- Multi-channel yields 37% more conversions

OPTIMAL TIMING:
- Best days: Tuesday (22-24%), Wednesday (21-23%), Thursday (20-22%)
- Avoid: Monday (17-19%), Friday (15-17%)
- Best times: 10-11 AM (30% higher connect rate), 4-5 PM (71% more effective vs noon)
- Avoid: 12-1 PM (lunch hour)

GATEKEEPER NAVIGATION:
- Transfer rate: 37% average
- Best technique: Referral mention (52% get-through rate)
- Trigger-based opening: 48% get-through rate
- Direct ask: only 28% get-through rate

OBJECTION HANDLING:
- Can lift close rates to 64% when done well
- Use ACE Framework: Acknowledge, Clarify, Engage
- Most objections appear in first 30-60 seconds
- 80% of prospects say 'no' 4+ times before saying 'yes'

SDR METRICS:
- Dials per day: 60-100
- Meetings booked per month: 15 average, 21 top performers
- Meeting show rate: 80%
- Book rate: 25-33% (meetings per conversation)
- Pipeline generated: $3M median annually per SDR
- Only 8% of salespeople make it to 5th follow-up
- 44% give up after one attempt

AI IMPACT IN 2025:
- 75% of B2B companies implementing AI for cold calling
- AI improves efficiency by 50%
- AI-powered teams hold 5x more conversations daily
- Connect rates improve 60% with AI-assisted objection handling

When analyzing performance, compare against these benchmarks and provide actionable recommendations.
`;
}
