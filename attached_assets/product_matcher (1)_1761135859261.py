import logging
import time
import pandas as pd
from database_handler import get_product_data
from utils import normalize_latvian_text

# Configure logging
logger = logging.getLogger(__name__)

def find_matching_product(text_segments):
    """
    Find a matching product in the database using the recognized text segments.
    Optimized to use database indexes for faster search with improved performance and error handling.
    
    Args:
        text_segments: List of text segments recognized from the image
        
    Returns:
        Tuple of (product_name, nutri_score) if a match is found, otherwise (None, None)
    """
    start_time = time.time()
    
    if not text_segments or len(text_segments) == 0:
        logger.warning("No text segments provided for matching")
        return None, None
    
    try:
        # Get product data from the database
        products_df = get_product_data()
        
        # Check if we have valid product data
        if products_df is None or products_df.empty:
            logger.warning("No products in the database or failed to retrieve product data")
            return None, None
            
        db_load_time = time.time() - start_time
        logger.debug(f"Time to load product data: {db_load_time:.2f} seconds")
        
        # Normalize text segments for consistent matching
        normalized_segments = [normalize_latvian_text(segment).lower() for segment in text_segments]
        
        # Filter out segments that are too short (less than 4 characters)
        filtered_segments = [segment for segment in normalized_segments if len(segment) > 3]
        
        if not filtered_segments:
            logger.info("No segments long enough for matching after filtering")
            return None, None
        
        # Filter potential product matches based on text segments
        potential_matches = []
        
        # First pass: look for products that match significant parts of any segment
        for segment in filtered_segments:
            # Find products whose normalized name contains this segment
            # This will utilize the index on normalized_name
            try:
                matches = products_df[products_df['normalized_name'].str.lower().str.contains(segment)]
            except Exception as e:
                logger.error(f"Error filtering products by segment '{segment}': {str(e)}")
                matches = pd.DataFrame()  # Empty DataFrame if error occurs
            
            for _, product in matches.iterrows():
                normalized_product_name = product['normalized_name'].lower()
                tokens = normalized_product_name.split()
                
                # Calculate a match score based on token overlap
                potential_matches.append({
                    'product_id': product['id'],
                    'product_name': product['name'],
                    'normalized_name': normalized_product_name,
                    'nutri_score': product['nutri_score'],
                    'matched_segment': segment,
                    'tokens_to_match': tokens,
                    'token_count': len(tokens),
                    'match_score': len(segment) / len(normalized_product_name) if normalized_product_name else 0
                })
        
        # No potential matches found
        if not potential_matches:
            logger.info("No potential matches found in the first pass")
            return None, None
        
        # Sort potential matches by token count (descending) to prioritize longer product names
        potential_matches.sort(key=lambda x: x['token_count'], reverse=True)
        
        # Second pass: verify that significant tokens of the product name are in the text segments
        confirmed_matches = []
        
        for match in potential_matches:
            tokens_to_match = match['tokens_to_match']
            significant_tokens = [token for token in tokens_to_match if len(token) > 3]
            
            if not significant_tokens:
                # If no significant tokens, use all tokens
                significant_tokens = tokens_to_match
            
            # Calculate how many significant tokens are found in the text segments
            matching_token_count = 0
            total_token_count = len(significant_tokens)
            
            for token in significant_tokens:
                token_found = any(token in segment for segment in filtered_segments)
                if token_found:
                    matching_token_count += 1
            
            # Calculate match confidence
            match_confidence = matching_token_count / total_token_count if total_token_count > 0 else 0
            
            # Add to confirmed matches if confidence exceeds threshold
            if match_confidence >= 0.6:  # At least 60% of tokens should match
                match['match_confidence'] = match_confidence
                confirmed_matches.append(match)
        
        # Return the best confirmed match
        if confirmed_matches:
            logger.info(f"Found {len(confirmed_matches)} confirmed matches")
            # Sort by match confidence, then by token count for specificity
            confirmed_matches.sort(key=lambda x: (x['match_confidence'], x['token_count']), reverse=True)
            best_match = confirmed_matches[0]
            
            # Log performance metrics
            total_time = time.time() - start_time
            logger.info(f"Best match: {best_match['product_name']} with confidence {best_match['match_confidence']:.2f}")
            logger.debug(f"Total product matching time: {total_time:.2f} seconds")
            
            return best_match['product_name'], best_match['nutri_score']
        else:
            logger.info("No confirmed matches found in the second pass")
            # Log performance even when no match is found
            total_time = time.time() - start_time
            logger.debug(f"Total product matching time (no match): {total_time:.2f} seconds")
            return None, None
            
    except Exception as e:
        # Log performance even when error occurs
        total_time = time.time() - start_time
        logger.error(f"Error in product matching: {str(e)}")
        logger.debug(f"Total product matching time (error): {total_time:.2f} seconds")
        return None, None
