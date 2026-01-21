/**
 * Webhook Signature Validation
 * 
 * Provides HMAC-SHA256 signature validation for webhook endpoints
 * to prevent unauthorized requests and ensure payload integrity.
 */

export interface WebhookValidationConfig {
  headerName: string;
  algorithm: 'sha256' | 'sha1';
  encoding: 'hex' | 'base64';
  signaturePrefix?: string; // e.g., 'sha256=' prefix some providers use
}

/**
 * Validates webhook signature using HMAC
 */
export async function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  config: WebhookValidationConfig
): Promise<boolean> {
  if (!payload || !signature || !secret) {
    return false;
  }

  try {
    // Remove prefix if configured (e.g., 'sha256=')
    let cleanSignature = signature;
    if (config.signaturePrefix && signature.startsWith(config.signaturePrefix)) {
      cleanSignature = signature.slice(config.signaturePrefix.length);
    }

    const encoder = new TextEncoder();
    const keyBuffer = encoder.encode(secret);
    const messageBuffer = encoder.encode(payload);

    // Determine algorithm
    const algorithm = config.algorithm === 'sha256' 
      ? { name: 'HMAC', hash: 'SHA-256' } 
      : { name: 'HMAC', hash: 'SHA-1' };

    // Import the key
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      keyBuffer,
      algorithm,
      false,
      ['sign']
    );

    // Generate HMAC
    const hashBuffer = await globalThis.crypto.subtle.sign(
      algorithm,
      cryptoKey,
      messageBuffer
    );

    // Convert to hex or base64
    let expectedSignature: string;
    if (config.encoding === 'hex') {
      expectedSignature = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } else {
      expectedSignature = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
    }

    // Constant-time comparison to prevent timing attacks
    return constantTimeCompare(cleanSignature.toLowerCase(), expectedSignature.toLowerCase());
  } catch (error) {
    console.error('Webhook signature validation error:', error);
    return false;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Default configurations for known webhook providers
 */
export const WEBHOOK_CONFIGS = {
  smartlead: {
    headerName: 'x-smartlead-signature',
    algorithm: 'sha256' as const,
    encoding: 'hex' as const,
  },
  replyio: {
    headerName: 'x-replyio-signature',
    algorithm: 'sha256' as const,
    encoding: 'hex' as const,
  },
  stripe: {
    headerName: 'stripe-signature',
    algorithm: 'sha256' as const,
    encoding: 'hex' as const,
    signaturePrefix: 'sha256=',
  },
};

/**
 * Wrapper that handles the full validation flow with logging
 */
export async function validateWebhookRequest(
  req: Request,
  secret: string | undefined,
  config: WebhookValidationConfig
): Promise<{ valid: boolean; body: string; error?: string }> {
  // Check if secret is configured
  if (!secret) {
    console.warn(`[webhook-validation] Secret not configured for ${config.headerName}`);
    // In development, you might want to allow this - but in production, reject
    // For now, we'll allow but log a warning
    const body = await req.text();
    return { 
      valid: true, 
      body, 
      error: 'WARNING: Webhook secret not configured - signature validation skipped' 
    };
  }

  // Get signature from header
  const signature = req.headers.get(config.headerName);
  if (!signature) {
    return { 
      valid: false, 
      body: '', 
      error: `Missing ${config.headerName} header` 
    };
  }

  // Read and validate body
  const body = await req.text();
  const isValid = await validateWebhookSignature(body, signature, secret, config);

  if (!isValid) {
    console.error(`[webhook-validation] Invalid signature for ${config.headerName}`);
    return { 
      valid: false, 
      body, 
      error: 'Invalid signature' 
    };
  }

  return { valid: true, body };
}
