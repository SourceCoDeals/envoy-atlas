// Segment classification utilities for lead enrichment

// ========== SENIORITY LEVELS ==========
export type SeniorityLevel = 'c_level' | 'vp' | 'director' | 'manager' | 'senior_ic' | 'ic' | 'unknown';

export const SENIORITY_LABELS: Record<SeniorityLevel, string> = {
  c_level: 'C-Level',
  vp: 'VP',
  director: 'Director',
  manager: 'Manager',
  senior_ic: 'Senior IC',
  ic: 'Individual Contributor',
  unknown: 'Unknown',
};

export const SENIORITY_ORDER: SeniorityLevel[] = ['c_level', 'vp', 'director', 'manager', 'senior_ic', 'ic', 'unknown'];

// ========== DEPARTMENT TYPES ==========
export type DepartmentType = 'sales' | 'marketing' | 'engineering' | 'product' | 'operations' | 'hr' | 'finance' | 'legal' | 'customer_success' | 'executive' | 'other';

export const DEPARTMENT_LABELS: Record<DepartmentType, string> = {
  sales: 'Sales',
  marketing: 'Marketing',
  engineering: 'Engineering',
  product: 'Product',
  operations: 'Operations',
  hr: 'HR/People',
  finance: 'Finance',
  legal: 'Legal',
  customer_success: 'Customer Success',
  executive: 'Executive',
  other: 'Other',
};

// ========== COMPANY SIZE CATEGORIES ==========
export type CompanySizeCategory = 'smb' | 'lower_mid' | 'upper_mid' | 'enterprise' | 'large_enterprise' | 'unknown';

export const COMPANY_SIZE_LABELS: Record<CompanySizeCategory, string> = {
  smb: 'SMB (1-50)',
  lower_mid: 'Lower Mid-Market (51-200)',
  upper_mid: 'Upper Mid-Market (201-1000)',
  enterprise: 'Enterprise (1001-5000)',
  large_enterprise: 'Large Enterprise (5000+)',
  unknown: 'Unknown',
};

// ========== CLASSIFICATION FUNCTIONS ==========

/**
 * Classify job title into seniority level
 */
export function classifySeniority(title: string | null | undefined): SeniorityLevel {
  if (!title) return 'unknown';
  
  const lower = title.toLowerCase().trim();
  
  // C-Level patterns
  if (/\b(ceo|cfo|cto|coo|cmo|cio|ciso|cpo|cro|chief|founder|co-founder|cofounder|owner|president|chairman)\b/.test(lower)) {
    return 'c_level';
  }
  
  // VP patterns
  if (/\b(vp|v\.p\.|vice\s*president|svp|evp|gvp|avp)\b/.test(lower)) {
    return 'vp';
  }
  
  // Director patterns
  if (/\b(director|head\s+of|dir\.|group\s+head)\b/.test(lower)) {
    return 'director';
  }
  
  // Manager patterns
  if (/\b(manager|mgr|lead|supervisor|team\s+lead|coordinator)\b/.test(lower)) {
    return 'manager';
  }
  
  // Senior IC patterns
  if (/\b(senior|sr\.|principal|staff|architect|fellow)\b/.test(lower)) {
    return 'senior_ic';
  }
  
  // If we have a title but couldn't classify higher, assume IC
  if (lower.length > 2) {
    return 'ic';
  }
  
  return 'unknown';
}

/**
 * Classify job title into department
 */
export function classifyDepartment(title: string | null | undefined): DepartmentType {
  if (!title) return 'other';
  
  const lower = title.toLowerCase().trim();
  
  // Executive/C-Suite
  if (/\b(ceo|coo|founder|co-founder|cofounder|owner|president|chairman)\b/.test(lower)) {
    return 'executive';
  }
  
  // Sales
  if (/\b(sales|account\s+executive|ae|sdr|bdr|business\s+development|revenue|commercial|deals)\b/.test(lower)) {
    return 'sales';
  }
  
  // Marketing
  if (/\b(marketing|growth|demand\s+gen|content|brand|communications|pr|public\s+relations|cmo)\b/.test(lower)) {
    return 'marketing';
  }
  
  // Engineering
  if (/\b(engineer|developer|dev|software|swe|backend|frontend|fullstack|devops|sre|cto|architect|programmer|coding)\b/.test(lower)) {
    return 'engineering';
  }
  
  // Product
  if (/\b(product|pm|cpo|product\s+management|ux|ui|design|user\s+experience)\b/.test(lower)) {
    return 'product';
  }
  
  // Operations
  if (/\b(operations|ops|supply\s+chain|logistics|procurement|coo)\b/.test(lower)) {
    return 'operations';
  }
  
  // HR/People
  if (/\b(hr|human\s+resources|people|talent|recruiting|recruiter|chro)\b/.test(lower)) {
    return 'hr';
  }
  
  // Finance
  if (/\b(finance|financial|cfo|accounting|accountant|controller|treasury|fp&a)\b/.test(lower)) {
    return 'finance';
  }
  
  // Legal
  if (/\b(legal|counsel|attorney|lawyer|compliance|regulatory|clo)\b/.test(lower)) {
    return 'legal';
  }
  
  // Customer Success
  if (/\b(customer\s+success|cs|csm|client\s+success|customer\s+experience|cx|support)\b/.test(lower)) {
    return 'customer_success';
  }
  
  return 'other';
}

/**
 * Classify company size string into category
 */
export function classifyCompanySize(size: string | number | null | undefined): CompanySizeCategory {
  if (size === null || size === undefined) return 'unknown';
  
  let employees: number | null = null;
  
  // If it's already a number
  if (typeof size === 'number') {
    employees = size;
  } else if (typeof size === 'string') {
    const lower = size.toLowerCase().trim();
    
    // Try to extract number from common formats
    // "1-10" -> 5, "11-50" -> 30, "100-500" -> 300, etc.
    const rangeMatch = lower.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1]);
      const max = parseInt(rangeMatch[2]);
      employees = Math.round((min + max) / 2);
    } else {
      // Try to find any number
      const numMatch = lower.match(/(\d+)/);
      if (numMatch) {
        employees = parseInt(numMatch[1]);
      } else {
        // Text-based matching
        if (/\b(small|startup|micro)\b/.test(lower)) return 'smb';
        if (/\b(mid|medium)\b/.test(lower)) return 'upper_mid';
        if (/\b(enterprise|large)\b/.test(lower)) return 'enterprise';
      }
    }
  }
  
  if (employees === null) return 'unknown';
  
  if (employees <= 50) return 'smb';
  if (employees <= 200) return 'lower_mid';
  if (employees <= 1000) return 'upper_mid';
  if (employees <= 5000) return 'enterprise';
  return 'large_enterprise';
}

/**
 * Get seniority label for display
 */
export function getSeniorityLabel(level: SeniorityLevel): string {
  return SENIORITY_LABELS[level] || level;
}

/**
 * Get department label for display
 */
export function getDepartmentLabel(dept: DepartmentType): string {
  return DEPARTMENT_LABELS[dept] || dept;
}

/**
 * Get company size label for display
 */
export function getCompanySizeLabel(size: CompanySizeCategory): string {
  return COMPANY_SIZE_LABELS[size] || size;
}

/**
 * Classify email domain as work or personal
 */
export function classifyEmailType(email: string | null | undefined): 'work' | 'personal' | 'unknown' {
  if (!email) return 'unknown';
  
  const domain = email.toLowerCase().split('@')[1];
  if (!domain) return 'unknown';
  
  const personalDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'me.com', 'mac.com', 'live.com', 'msn.com',
    'protonmail.com', 'mail.com', 'ymail.com', 'inbox.com',
    'zoho.com', 'fastmail.com', 'tutanota.com',
  ];
  
  if (personalDomains.includes(domain)) return 'personal';
  
  return 'work';
}

/**
 * Extract email domain from email address
 */
export function extractEmailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const parts = email.toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : null;
}

// ========== BATCH ENRICHMENT ==========

export interface LeadEnrichmentInput {
  id: string;
  title?: string | null;
  email?: string | null;
  company_size?: string | null;
}

export interface LeadEnrichmentOutput {
  id: string;
  seniority_level: SeniorityLevel;
  department: DepartmentType;
  company_size_category: CompanySizeCategory;
  email_type: 'work' | 'personal' | 'unknown';
  email_domain: string | null;
}

/**
 * Enrich a batch of leads with derived segment data
 */
export function enrichLeads(leads: LeadEnrichmentInput[]): LeadEnrichmentOutput[] {
  return leads.map(lead => ({
    id: lead.id,
    seniority_level: classifySeniority(lead.title),
    department: classifyDepartment(lead.title),
    company_size_category: classifyCompanySize(lead.company_size),
    email_type: classifyEmailType(lead.email),
    email_domain: extractEmailDomain(lead.email),
  }));
}

// ========== UNIFIED SEGMENT COPY PATTERNS ==========
// These patterns are used consistently across Audience Insights and Copy Insights

export const SEGMENT_COPY_PATTERNS = {
  // Subject line patterns
  'question_subject': 'Question Subject',
  'statement_subject': 'Statement Subject',
  'intrigue_subject': 'Intrigue Subject',
  'personalized_subject': 'Personalized Subject',
  
  // Opening patterns
  'personalized_open': 'Personalized Open',
  'trigger_open': 'Trigger Event Open',
  'value_first': 'Value First',
  'question_open': 'Question Open',
  'social_proof_open': 'Social Proof Open',
  
  // CTA patterns
  'soft_cta': 'Soft CTA',
  'direct_cta': 'Direct Ask',
  'value_cta': 'Value Offer CTA',
  'choice_cta': 'Choice CTA',
} as const;

export type SegmentCopyPattern = keyof typeof SEGMENT_COPY_PATTERNS;

export function getSegmentCopyPatternLabel(pattern: SegmentCopyPattern | string): string {
  return SEGMENT_COPY_PATTERNS[pattern as SegmentCopyPattern] || pattern.replace(/_/g, ' ');
}

// Get array of main patterns for matrix display (top 6)
export function getMatrixPatterns(): { key: string; label: string }[] {
  return [
    { key: 'question_subject', label: 'Question Subject' },
    { key: 'personalized_open', label: 'Personalized Open' },
    { key: 'value_first', label: 'Value First' },
    { key: 'direct_cta', label: 'Direct Ask' },
    { key: 'soft_cta', label: 'Soft CTA' },
    { key: 'social_proof_open', label: 'Social Proof' },
  ];
}
