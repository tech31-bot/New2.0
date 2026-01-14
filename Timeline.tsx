import React, { useRef, useEffect } from 'react';
import { Segment, UploadedImage } from '../types';

interface TimelineProps {
  segments: Segment[];
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  uploadedImages: UploadedImage[];
  onAssignImage: (segmentId: string, imageId: string) => void;
}

const Timeline: React.FC<TimelineProps> = ({
  segments,
  duration,
  currentTime,
  onSeek,
  uploadedImages,
  onAssignImage
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, imageId: string) => {
    e.dataTransfer.setData('imageId', imageId);
  };

  const handleDrop = (e: React.DragEvent, segmentId: string) => {
    e.preventDefault();
    const imageId = e.dataTransfer.getData('imageId');
    if (imageId) {
      onAssignImage(segmentId, imageId);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Click on timeline to seek
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || duration === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    onSeek(percentage * duration);
  };

  // Calculate pixel width factor (min 100px per segment for readability or fit to screen)
  // For a 2 hour video, this would be huge, so we need a scrollable container.
  // We'll scale: 1 second = 20 pixels.
  const PIXELS_PER_SECOND = 50;
  const totalWidth = Math.max(duration * PIXELS_PER_SECOND, 800); // Minimum width

  return (
    <div className="w-full bg-gray-900 border-t border-gray-800 flex flex-col h-64 select-none">
      {/* Header / Tools */}
      <div className="px-4 py-2 bg-gray-800 flex justify-between items-center text-xs text-gray-400">
        <span>Timeline ({segments.length} segments)</span>
        <span>Drag images from the gallery onto segments below</span>
      </div>

      {/* Scrollable Track Area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar relative" ref={containerRef}>
        <div
            className="relative h-full"
            style={{ width: `${totalWidth}px` }}
        >
            {/* Time Markers */}
            <div className="absolute top-0 left-0 w-full h-6 border-b border-gray-700 flex text-xs text-gray-500 pointer-events-none">
                {Array.from({ length: Math.ceil(duration / 5) }).map((_, i) => (
                    <div key={i} className="absolute border-l border-gray-700 pl-1 h-full" style={{ left: `${i * 5 * PIXELS_PER_SECOND}px` }}>
                        {new Date(i * 5 * 1000).toISOString().substr(14, 5)}
                    </div>
                ))}
            </div>

            {/* Playhead */}
            <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-50 pointer-events-none transition-all duration-75"
                style={{ left: `${currentTime * PIXELS_PER_SECOND}px` }}
            >
                <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.5 -mt-1.5"></div>
            </div>

             {/* Click capture layer for seeking */}
            <div
                className="absolute inset-0 z-40 cursor-pointer"
                onClick={handleTimelineClick}
                title="Click to seek"
            />


            {/* Segments Track */}
            <div className="absolute top-8 left-0 h-32 w-full flex pointer-events-none">
                {segments.map((seg) => {
                    const width = (seg.endTime - seg.startTime) * PIXELS_PER_SECOND;
                    const left = seg.startTime * PIXELS_PER_SECOND;
                    const assignedImg = uploadedImages.find(img => img.id === seg.assignedImageId);

                    return (
                        <div
                            key={seg.id}
                            className={`absolute top-0 h-full border-r border-gray-800 bg-gray-800/50 group pointer-events-auto transition-colors hover:bg-gray-700/50 flex flex-col overflow-hidden`}
                            style={{ left: `${left}px`, width: `${width}px` }}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, seg.id)}
                        >
                            {/* Visual Content Preview */}
                            <div className="flex-1 w-full relative overflow-hidden bg-black/20">
                                {assignedImg ? (
                                    <img src={assignedImg.url} alt="segment visual" className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-[10px] p-2 text-center bg-gray-900">
                                        Drag Image Here
                                    </div>
                                )}
                                <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white">
                                    {seg.emotion}
                                </div>
                            </div>

                            {/* Text / Captions */}
                            <div className="h-10 px-2 py-1 text-[10px] text-gray-300 leading-tight border-t border-gray-700 bg-gray-800 truncate whitespace-normal">
                                {seg.text}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
