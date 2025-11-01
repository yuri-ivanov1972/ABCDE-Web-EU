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

  // Save a base64 image to object storage and return the public URL
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

    // Return the GCS public URL
    return `https://storage.googleapis.com/${bucketName}/${objectName}`;
  }

  // Delete a file from object storage by URL
  async deleteImageByUrl(imageUrl: string): Promise<void> {
    try {
      // Extract bucket and object name from URL
      // Format: https://storage.googleapis.com/bucket-name/path/to/file.jpg
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/').filter(p => p);
      
      if (pathParts.length < 2) {
        throw new Error('Invalid image URL');
      }

      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join('/');

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
