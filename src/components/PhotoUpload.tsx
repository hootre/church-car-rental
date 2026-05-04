"use client";

import { useState, useRef } from "react";
import toast from "react-hot-toast";
import { supabase, ReservationPhoto } from "@/lib/supabase";

interface PhotoUploadProps {
  reservationId: string;
  photoType: "pickup" | "return";
  existingPhotos?: ReservationPhoto[];
  onUploadComplete?: () => void;
  readOnly?: boolean;
}

export default function PhotoUpload({
  reservationId,
  photoType,
  existingPhotos = [],
  onUploadComplete,
  readOnly = false,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<ReservationPhoto[]>(existingPhotos);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const label = photoType === "pickup" ? "대여" : "반납";
  const maxPhotos = 5;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > maxPhotos) {
      toast.error(`사진은 최대 ${maxPhotos}장까지 업로드 가능합니다`);
      return;
    }

    setUploading(true);

    for (const file of Array.from(files)) {
      // 파일 크기 체크 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}: 5MB 이하의 파일만 업로드 가능합니다`);
        continue;
      }

      // 이미지 리사이즈 (모바일 사진이 크므로)
      const resizedFile = await resizeImage(file, 1200);

      // Supabase Storage 업로드
      const fileName = `${reservationId}/${photoType}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("vehicle-photos")
        .upload(fileName, resizedFile, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        toast.error("사진 업로드에 실패했습니다");
        console.error(uploadError);
        continue;
      }

      // 공개 URL 가져오기
      const { data: urlData } = supabase.storage
        .from("vehicle-photos")
        .getPublicUrl(fileName);

      // DB에 기록
      const { data: photoData, error: dbError } = await supabase
        .from("reservation_photos")
        .insert({
          reservation_id: reservationId,
          photo_type: photoType,
          photo_url: urlData.publicUrl,
        })
        .select()
        .single();

      if (dbError) {
        toast.error("사진 정보 저장에 실패했습니다");
        console.error(dbError);
      } else if (photoData) {
        setPhotos((prev) => [...prev, photoData]);
      }
    }

    setUploading(false);
    toast.success("사진이 업로드되었습니다");
    onUploadComplete?.();

    // input 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleDelete(photo: ReservationPhoto) {
    if (!confirm("이 사진을 삭제하시겠습니까?")) return;

    // Storage에서 삭제
    const path = photo.photo_url.split("/vehicle-photos/")[1];
    if (path) {
      await supabase.storage.from("vehicle-photos").remove([path]);
    }

    // DB에서 삭제
    await supabase.from("reservation_photos").delete().eq("id", photo.id);

    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    toast.success("삭제되었습니다");
    onUploadComplete?.();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-700">
          {label} 시 차량 사진
        </h4>
        <span className="text-xs text-gray-400">
          {photos.length}/{maxPhotos}
        </span>
      </div>

      {/* 사진 그리드 */}
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative group aspect-square">
            <button
              type="button"
              onClick={() => setPreviewUrl(photo.photo_url)}
              className="w-full h-full"
            >
              <img
                src={photo.photo_url}
                alt={`${label} 사진`}
                className="w-full h-full object-cover rounded-xl border border-gray-200"
              />
            </button>
            {!readOnly && (
              <button
                onClick={() => handleDelete(photo)}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full
                           flex items-center justify-center text-xs opacity-0 group-hover:opacity-100
                           transition-opacity shadow-sm"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {/* 업로드 버튼 */}
        {!readOnly && photos.length < maxPhotos && (
          <label
            className={`aspect-square border-2 border-dashed border-gray-300 rounded-xl
                        flex flex-col items-center justify-center cursor-pointer
                        hover:border-primary-400 hover:bg-primary-50 transition-colors
                        ${uploading ? "opacity-50 pointer-events-none" : ""}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleUpload}
              className="hidden"
            />
            {uploading ? (
              <div className="text-xs text-gray-400">업로드중...</div>
            ) : (
              <>
                <svg
                  className="w-6 h-6 text-gray-400 mb-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="text-[10px] text-gray-400">사진 추가</span>
              </>
            )}
          </label>
        )}
      </div>

      {photos.length === 0 && readOnly && (
        <p className="text-xs text-gray-400 text-center py-4">
          등록된 사진이 없습니다
        </p>
      )}

      {/* 이미지 프리뷰 모달 */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewUrl}
              alt="미리보기"
              className="w-full rounded-2xl"
            />
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full
                         flex items-center justify-center text-lg"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 이미지 리사이즈 유틸리티
async function resizeImage(file: File, maxWidth: number): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    img.onload = () => {
      let { width, height } = img;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => resolve(blob || file),
        "image/jpeg",
        0.85
      );
    };

    img.src = URL.createObjectURL(file);
  });
}
