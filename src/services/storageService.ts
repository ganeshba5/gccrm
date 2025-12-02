import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../lib/firebase';
import type { NoteAttachment } from '../types/note';

class StorageService {
  private readonly storage = storage;

  /**
   * Upload a file to Firebase Storage
   * @param file File to upload
   * @param path Storage path (e.g., 'notes/attachments/')
   * @returns Promise with download URL and file metadata
   */
  async uploadFile(file: File, path: string): Promise<NoteAttachment> {
    try {
      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}_${sanitizedFileName}`;
      const filePath = `${path}${fileName}`;
      
      const storageRef = ref(this.storage, filePath);
      
      // Upload file
      await uploadBytes(storageRef, file);
      
      // Get download URL
      const url = await getDownloadURL(storageRef);
      
      // Return attachment metadata
      return {
        id: fileName,
        name: file.name,
        url,
        size: file.size,
        type: file.type,
        uploadedAt: new Date(),
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('Failed to upload file');
    }
  }

  /**
   * Delete a file from Firebase Storage
   * @param path Storage path to the file
   */
  async deleteFile(path: string): Promise<void> {
    try {
      const storageRef = ref(this.storage, path);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error('Failed to delete file');
    }
  }

  /**
   * Get download URL for a file
   * @param path Storage path to the file
   * @returns Download URL
   */
  async getDownloadURL(path: string): Promise<string> {
    try {
      const storageRef = ref(this.storage, path);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('Error getting download URL:', error);
      throw new Error('Failed to get download URL');
    }
  }
}

export const storageService = new StorageService();

