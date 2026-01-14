import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, Play, Pause, Image as ImageIcon, Music, Loader2, Download, Video } from 'lucide-react';
import { analyzeAudioAndSegment, matchImagesToSegments } from './services/geminiService';
import { Segment, UploadedImage, ProcessingState, VideoProject } from './types';
import Timeline from './components/Timeline';

const App: React.FC = () => {
  // --- State ---
  const [project, setProject] = useState<VideoProject>({
    audioFile: null,
    audioUrl: null,
    duration: 0,
    segments: [],
  });
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [processing, setProcessing] = useState<ProcessingState>({ status: 'idle', message: '' });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // --- Refs ---
  const audioRef = useRef<HTMLAudioElement>(null);
  const requestRef = useRef<number>();

  // --- Handlers ---

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset project state slightly
    setProject(prev => ({ ...prev, audioFile: file, audioUrl: URL.createObjectURL(file), segments: [] }));
    setProcessing({ status: 'analyzing', message: 'Listening and analyzing audio structure...' });

    try {
      // 1. Get audio duration first for UI
      const audio = new Audio(URL.createObjectURL(file));
      await new Promise(resolve => {
        audio.onloadedmetadata = () => {
          setProject(p => ({ ...p, duration: audio.duration }));
          resolve(true);
        };
      });

      // 2. Call Gemini Service
      const segments = await analyzeAudioAndSegment(file);

      // 3. Auto-match if images exist already
      const segmentsWithImages = await matchImagesToSegments(segments, images);

      setProject(prev => ({ ...prev, segments: segmentsWithImages }));
      setProcessing({ status: 'ready', message: 'Analysis complete.' });

    } catch (err: any) {
      setProcessing({ status: 'error', message: err.message || 'Analysis failed.' });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages: UploadedImage[] = Array.from(e.target.files).map((file: File) => ({
        id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        url: URL.createObjectURL(file),
        name: file.name
      }));

      setImages(prev => {
        const updated = [...prev, ...newImages];
        // If we have segments but no assigned images yet, try to auto-assign casually
        if (project.segments.length > 0) {
           const updatedSegments = project.segments.map((seg, i) => {
               if(!seg.assignedImageId) {
                   return { ...seg, assignedImageId: updated[i % updated.length].id };
               }
               return seg;
           });
           setProject(p => ({ ...p, segments: updatedSegments }));
        }
        return updated;
      });
    }
  };

  const assignImageToSegment = (segmentId: string, imageId: string) => {
    setProject(prev => ({
      ...prev,
      segments: prev.segments.map(seg =>
        seg.id === segmentId ? { ...seg, assignedImageId: imageId } : seg
      )
    }));
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  // --- Derived State for Preview ---
  const currentSegment = useMemo(() => {
    return project.segments.find(
      seg => currentTime >= seg.startTime && currentTime < seg.endTime
    );
  }, [currentTime, project.segments]);

  const currentDisplayImage = useMemo(() => {
    if (!currentSegment || !currentSegment.assignedImageId) return null;
    return images.find(img => img.id === currentSegment.assignedImageId);
  }, [currentSegment, images]);

  // Clean up object URLs
  useEffect(() => {
      return () => {
          if (project.audioUrl) URL.revokeObjectURL(project.audioUrl);
          images.forEach(img => URL.revokeObjectURL(img.url));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white font-sans">
      {/* --- Top Bar --- */}
      <header className="h-14 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Video className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">AI Auto-Editor</h1>
        </div>
        <div className="flex items-center gap-4">
             {processing.status === 'analyzing' && (
                 <div className="flex items-center gap-2 text-indigo-400 text-sm animate-pulse">
                     <Loader2 className="w-4 h-4 animate-spin" />
                     {processing.message}
                 </div>
             )}
            <button
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2"
                onClick={() => alert("Rendering feature would require backend processing (ffmpeg). This preview demonstrates the synced output.")}
            >
                <Download className="w-4 h-4" /> Export Video
            </button>
        </div>
      </header>

      {/* --- Main Content Area --- */}
      <main className="flex-1 flex overflow-hidden">

        {/* --- Left: Assets Library --- */}
        <aside className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col z-20">
          <div className="p-4 border-b border-gray-800">
             <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Media Assets</h2>

             {/* Audio Input */}
             <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-1">Narration (Audio)</label>
                <label className="flex items-center justify-center w-full h-12 border border-dashed border-gray-700 rounded-lg hover:border-indigo-500 hover:bg-gray-800 cursor-pointer transition-colors group">
                    <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
                    <div className="flex items-center gap-2 text-gray-400 group-hover:text-indigo-400">
                        <Music className="w-4 h-4" />
                        <span className="text-xs">{project.audioFile ? project.audioFile.name : "Upload Voice File"}</span>
                    </div>
                </label>
             </div>

             {/* Image Input */}
             <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Visuals (Unlimited)</label>
                <label className="flex items-center justify-center w-full h-12 border border-dashed border-gray-700 rounded-lg hover:border-indigo-500 hover:bg-gray-800 cursor-pointer transition-colors group">
                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                    <div className="flex items-center gap-2 text-gray-400 group-hover:text-indigo-400">
                        <Upload className="w-4 h-4" />
                        <span className="text-xs">Add Images</span>
                    </div>
                </label>
             </div>
          </div>

          {/* Gallery Grid */}
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            <div className="grid grid-cols-2 gap-2">
                {images.map((img) => (
                    <div
                        key={img.id}
                        className="aspect-square rounded-md overflow-hidden relative group cursor-grab active:cursor-grabbing border border-gray-800"
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData('imageId', img.id); }}
                    >
                        <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
                             <p className="text-[10px] text-white truncate w-full">{img.name}</p>
                        </div>
                    </div>
                ))}
            </div>
            {images.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-2 p-4 text-center">
                    <ImageIcon className="w-8 h-8 opacity-20" />
                    <p className="text-xs">No images uploaded yet.</p>
                </div>
            )}
          </div>
        </aside>

        {/* --- Center: Preview Player --- */}
        <section className="flex-1 flex flex-col bg-black relative">
            {/* The Video "Screen" */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                {/* Background Blur */}
                <div className="absolute inset-0 z-0">
                    {currentDisplayImage && (
                        <img src={currentDisplayImage.url} alt="bg" className="w-full h-full object-cover blur-3xl opacity-30 scale-110" />
                    )}
                </div>

                {/* Main Content */}
                <div className="relative z-10 aspect-video w-full max-w-4xl bg-gray-950 shadow-2xl border border-gray-800 rounded-lg overflow-hidden flex items-center justify-center">
                    {currentDisplayImage ? (
                        <img
                           src={currentDisplayImage.url}
                           alt="Current Scene"
                           className="w-full h-full object-contain animate-fade-in"
                        />
                    ) : (
                        <div className="text-gray-600 flex flex-col items-center gap-3">
                            {project.audioFile ? (
                                <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center animate-pulse">
                                    <Music className="w-6 h-6 text-indigo-500" />
                                </div>
                            ) : (
                                <p className="text-sm">Upload audio to begin</p>
                            )}
                             <p className="text-xs text-gray-500 max-w-xs text-center">
                                 {currentSegment?.visualPrompt || "Waiting for content..."}
                             </p>
                        </div>
                    )}

                    {/* Captions Overlay */}
                    {currentSegment && (
                        <div className="absolute bottom-8 left-0 right-0 text-center px-4">
                            <span className="inline-block px-4 py-2 bg-black/70 backdrop-blur-sm rounded-lg text-white text-lg font-medium shadow-lg">
                                {currentSegment.text}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Playback Controls */}
            <div className="h-14 bg-gray-900 border-t border-gray-800 flex items-center justify-center gap-6 px-4">
                <button
                    onClick={togglePlay}
                    disabled={!project.audioUrl}
                    className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>
                <div className="text-xs text-gray-400 font-mono w-32 text-center">
                    {new Date(currentTime * 1000).toISOString().substr(14, 5)} / {new Date(project.duration * 1000).toISOString().substr(14, 5)}
                </div>
            </div>
        </section>
      </main>

      {/* --- Bottom: Timeline --- */}
      <footer className="h-64 z-30">
        <Timeline
            segments={project.segments}
            duration={project.duration}
            currentTime={currentTime}
            onSeek={handleSeek}
            uploadedImages={images}
            onAssignImage={assignImageToSegment}
        />
      </footer>

      {/* Hidden Audio Element */}
      {project.audioUrl && (
          <audio
            ref={audioRef}
            src={project.audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
      )}
    </div>
  );
};

export default App;