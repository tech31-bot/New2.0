export interface Segment {
  id: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
  visualPrompt: string;
  emotion: string;
  assignedImageId?: string; // ID of the user uploaded image
}

export interface UploadedImage {
  id: string;
  file: File;
  url: string;
  name: string;
}

export interface ProcessingState {
  status: 'idle' | 'analyzing' | 'matching' | 'ready' | 'error';
  message: string;
}

export interface VideoProject {
  audioFile: File | null;
  audioUrl: string | null;
  duration: number;
  segments: Segment[];
}