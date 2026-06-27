"use client";

import { useState, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { uploadResume, type ResumeProfile } from "@/lib/profile";

interface ResumeUploadProps {
  onUploaded: (profile: ResumeProfile) => void;
  onError: (msg: string) => void;
}

export default function ResumeUpload({ onUploaded, onError }: ResumeUploadProps) {
  const { getToken } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".pdf") && !fileName.endsWith(".txt")) {
      onError("Only PDF and TXT files are supported");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError("File too large. Max 5MB.");
      return;
    }

    setIsUploading(true);
    try {
      const token = await getToken();
      if (!token) {
        onError("Not authenticated. Please sign in again.");
        return;
      }
      const profile = await uploadResume(token, file);
      onUploaded(profile);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }, [getToken, onUploaded, onError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all
        ${isDragging
          ? "border-accent bg-accent-light/30"
          : "border-card-border hover:border-border hover:bg-surface"
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt"
        onChange={handleChange}
        className="hidden"
      />

      {isUploading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted">Parsing your resume with AI…</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-accent-light flex items-center justify-center">
            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground">
            Drop your resume here
          </p>
          <p className="text-xs text-muted">
            PDF or TXT, max 5MB
          </p>
        </div>
      )}
    </div>
  );
}
