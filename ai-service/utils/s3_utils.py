import boto3
import os
from config import Config
from logger import logger

s3_client = boto3.client(
    "s3",
    aws_access_key_id=Config.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=Config.AWS_SECRET_ACCESS_KEY,
    region_name=Config.AWS_REGION,
)

def download_s3_file(file_url: str, temp_file_path: str):
    """Downloads a file from S3 given its public or path-style URL."""
    try:
        bucket_name = Config.AWS_BUCKET_NAME
        region = Config.AWS_REGION
        
        # Virtual-host vs Path-style URLs
        prefix = f"https://{bucket_name}.s3.{region}.amazonaws.com/"
        if prefix in file_url:
            key = file_url.split(prefix)[1]
        else:
            key = file_url.split(".amazonaws.com/")[1]
            
        logger.info(f"S3 Download initiating: {key}")
        s3_client.download_file(bucket_name, key, temp_file_path)
        logger.info(f"S3 Download complete.")
        return True
        
    except Exception as e:
        logger.error(f"S3 Download failed: {str(e)}")
        raise e
