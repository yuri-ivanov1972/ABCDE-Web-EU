/**
 * Google Tag Manager Analytics Utility
 * 
 * Sends custom events to GTM's dataLayer for tracking user activity
 */

interface GTMWindow extends Window {
  dataLayer?: any[];
}

declare const window: GTMWindow;

/**
 * Send a custom event to Google Tag Manager
 */
function pushToDataLayer(data: Record<string, any>) {
  if (typeof window !== 'undefined' && window.dataLayer) {
    window.dataLayer.push(data);
  }
}

/**
 * Track when a product is successfully scanned via OCR
 */
export function trackProductScanned(params: {
  productId: number;
  productName: string;
  nutriScore?: string;
  confidence?: number;
}) {
  pushToDataLayer({
    event: 'product_scanned',
    product_id: params.productId,
    product_name: params.productName,
    nutri_score: params.nutriScore || 'unknown',
    scan_confidence: params.confidence || 0,
  });
}

/**
 * Track when user clicks "View Details" button after scanning
 */
export function trackProductViewAfterScan(params: {
  productId: number;
  productName: string;
  nutriScore?: string;
}) {
  pushToDataLayer({
    event: 'product_view_after_scan',
    product_id: params.productId,
    product_name: params.productName,
    nutri_score: params.nutriScore || 'unknown',
  });
}

/**
 * Track when the petition link is clicked
 */
export function trackPetitionClick(params: {
  linkUrl: string;
  linkText: string;
  language: string;
}) {
  pushToDataLayer({
    event: 'petition_click',
    link_url: params.linkUrl,
    link_text: params.linkText,
    language: params.language,
  });
}

/**
 * Track when camera permission is granted or denied
 */
export function trackCameraPermission(params: {
  permission: 'granted' | 'denied';
  error?: string;
}) {
  pushToDataLayer({
    event: 'camera_permission',
    permission_status: params.permission,
    error_message: params.error || null,
  });
}

/**
 * Track when OCR scan fails to detect a product
 */
export function trackScanFailure(params: {
  reason: string;
  hasText: boolean;
}) {
  pushToDataLayer({
    event: 'scan_failure',
    failure_reason: params.reason,
    text_detected: params.hasText,
  });
}
