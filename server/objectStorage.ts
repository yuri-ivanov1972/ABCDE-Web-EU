// Simplified Object Storage Service for backend-only photo storage
// From blueprint: javascript_object_storage
import { Storage, File } from "@google-cloud/storage";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// The object storage client is used to interact with the object storage service.
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service for backend photo storage
export class ObjectStorageService {
  constructor() {}

  // Gets the private object directory
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  // Save a base64 image to object storage and return the storage path (not a URL)
  async saveImageFromBase64(base64Image: string, filename?: string): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    
    // Generate unique filename if not provided
    const imageFilename = filename || `scan-${Date.now()}-${randomUUID()}.jpg`;
    const fullPath = `${privateObjectDir}/scans/${imageFilename}`;

    // Parse the path
    const { bucketName, objectName } = parseObjectPath(fullPath);
    
    // Get bucket and file reference
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    // Strip data URL prefix if present (data:image/jpeg;base64,)
    const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Convert base64 to buffer
    const buffer = Buffer.from(cleanBase64, 'base64');

    // Upload the file
    await file.save(buffer, {
      metadata: {
        contentType: 'image/jpeg',
      },
    });

    // Return the storage path (gs:// format) for later signed URL generation
    return `gs://${bucketName}/${objectName}`;
  }

  // Generate a signed URL for a stored image (30-day expiration)
  async getSignedUrl(storagePath: string): Promise<string> {
    try {
      // Parse gs:// path
      if (!storagePath.startsWith('gs://')) {
        throw new Error('Invalid storage path - must start with gs://');
      }
      
      const pathWithoutProtocol = storagePath.substring(5); // Remove 'gs://'
      const slashIndex = pathWithoutProtocol.indexOf('/');
      
      if (slashIndex === -1) {
        throw new Error('Invalid storage path - no object name found');
      }
      
      const bucketName = pathWithoutProtocol.substring(0, slashIndex);
      const objectName = pathWithoutProtocol.substring(slashIndex + 1);

      // Use Replit's sidecar endpoint to generate signed URL
      // 30 days in seconds
      const ttlSec = 30 * 24 * 60 * 60;
      const signedUrl = await signObjectURL({
        bucketName,
        objectName,
        method: 'GET',
        ttlSec
      });

      return signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw error;
    }
  }

  // Delete a file from object storage by URL or storage path
  async deleteImageByUrl(imageUrl: string): Promise<void> {
    try {
      let bucketName: string;
      let objectName: string;

      // Handle gs:// storage paths
      if (imageUrl.startsWith('gs://')) {
        const pathWithoutProtocol = imageUrl.substring(5);
        const slashIndex = pathWithoutProtocol.indexOf('/');
        
        if (slashIndex === -1) {
          throw new Error('Invalid storage path');
        }
        
        bucketName = pathWithoutProtocol.substring(0, slashIndex);
        objectName = pathWithoutProtocol.substring(slashIndex + 1);
      } else {
        // Handle https:// URLs (for backwards compatibility)
        const url = new URL(imageUrl);
        const pathParts = url.pathname.split('/').filter(p => p);
        
        if (pathParts.length < 2) {
          throw new Error('Invalid image URL');
        }

        bucketName = pathParts[0];
        objectName = pathParts.slice(1).join('/');
      }

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      await file.delete();
    } catch (error) {
      console.error('Error deleting image:', error);
      // Don't throw - cleanup should be non-blocking
    }
  }

  // Get a file reference from a URL
  async getFileFromUrl(imageUrl: string): Promise<File | null> {
    try {
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/').filter(p => p);
      
      if (pathParts.length < 2) {
        return null;
      }

      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join('/');

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      return exists ? file : null;
    } catch (error) {
      return null;
    }
  }

  // Get a file reference from a storage path (gs:// format)
  async getFileFromStoragePath(storagePath: string): Promise<File | null> {
    try {
      if (!storagePath.startsWith('gs://')) {
        return null;
      }

      const pathWithoutProtocol = storagePath.substring(5); // Remove 'gs://'
      const slashIndex = pathWithoutProtocol.indexOf('/');
      
      if (slashIndex === -1) {
        return null;
      }
      
      const bucketName = pathWithoutProtocol.substring(0, slashIndex);
      const objectName = pathWithoutProtocol.substring(slashIndex + 1);

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      return exists ? file : null;
    } catch (error) {
      console.error('Error getting file from storage path:', error);
      return null;
    }
  }

  // Download/stream an object to the response
  async downloadObject(file: File, res: any): Promise<void> {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
      
      // Set appropriate headers
      res.set({
        'Content-Type': metadata.contentType || 'application/octet-stream',
        'Content-Length': metadata.size,
        'Cache-Control': 'private, max-age=2592000', // 30 days cache
      });

      // Stream the file to the response
      const stream = file.createReadStream();

      stream.on('error', (err) => {
        console.error('Stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error streaming file' });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error('Error downloading file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error downloading file' });
      }
    }
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}
