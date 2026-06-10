import os
import io
import logging
import base64
import requests
from google.cloud import vision
from google.oauth2 import service_account
from utils import normalize_latvian_text

# Configure logging
logger = logging.getLogger(__name__)

def get_vision_client():
    """
    Creates and returns a Google Vision API client.
    Uses either API key or service account credentials based on availability.
    """
    api_key = os.environ.get("GOOGLE_CLOUD_API_KEY")
    
    if api_key:
        return None  # We'll use the API key directly in the REST API request
    else:
        # Try to use service account credentials if available
        try:
            credentials = service_account.Credentials.from_service_account_file(
                os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', 'service-account.json')
            )
            return vision.ImageAnnotatorClient(credentials=credentials)
        except Exception as e:
            logger.error(f"Failed to create Vision client: {str(e)}")
            raise ValueError("Unable to initialize Google Cloud Vision API. Check your credentials.")

def recognize_text_from_image(image_file):
    """
    Recognizes text from an image using Google Cloud Vision API.
    
    Args:
        image_file: A file-like object containing the image data.
        
    Returns:
        A list of recognized text segments.
    """
    try:
        api_key = os.environ.get("GOOGLE_CLOUD_API_KEY")
        
        # Read the image content
        image_content = image_file.read()
        
        if api_key:
            # Using REST API with API key
            return recognize_text_with_rest_api(image_content, api_key)
        else:
            # Using client library
            return recognize_text_with_client_library(image_content)
    
    except Exception as e:
        logger.error(f"Error in text recognition: {str(e)}")
        raise

def recognize_text_with_rest_api(image_content, api_key):
    """
    Recognizes text using the Google Cloud Vision REST API with an API key.
    """
    # Encode image to base64
    encoded_image = base64.b64encode(image_content).decode('UTF-8')
    
    # Prepare the request body
    request_body = {
        'requests': [
            {
                'image': {
                    'content': encoded_image
                },
                'features': [
                    {
                        'type': 'TEXT_DETECTION'
                    }
                ]
            }
        ]
    }
    
    # Send the request to the Vision API
    response = requests.post(
        f'https://vision.googleapis.com/v1/images:annotate?key={api_key}',
        json=request_body
    )
    
    if response.status_code != 200:
        logger.error(f"Vision API error: {response.text}")
        raise Exception(f"Vision API error: {response.status_code}")
    
    # Process the response
    result = response.json()
    
    # Extract and normalize text segments
    text_segments = []
    
    try:
        annotations = result['responses'][0]['textAnnotations']
        # Skip the first element which is the entire text
        for annotation in annotations[1:]:
            text = annotation['description']
            # Normalize the text (replace Latvian characters)
            normalized_text = normalize_latvian_text(text)
            if len(normalized_text) > 3:  # Only include segments longer than 3 characters
                text_segments.append(normalized_text)
    except (KeyError, IndexError) as e:
        logger.warning(f"No text detected or unexpected response format: {str(e)}")
    
    return text_segments

def recognize_text_with_client_library(image_content):
    """
    Recognizes text using the Google Cloud Vision client library.
    """
    client = get_vision_client()
    
    if not client:
        raise ValueError("Vision client is not initialized.")
    
    # Create an Image object
    image = vision.Image(content=image_content)
    
    # Detect text in the image
    response = client.text_detection(image=image)
    
    if response.error.message:
        logger.error(f"Vision API error: {response.error.message}")
        raise Exception(f"Vision API error: {response.error.message}")
    
    # Extract and normalize text segments
    text_segments = []
    
    # Skip the first text annotation which is the entire text
    for text_annotation in response.text_annotations[1:]:
        text = text_annotation.description
        # Normalize the text (replace Latvian characters)
        normalized_text = normalize_latvian_text(text)
        if len(normalized_text) > 3:  # Only include segments longer than 3 characters
            text_segments.append(normalized_text)
    
    return text_segments
