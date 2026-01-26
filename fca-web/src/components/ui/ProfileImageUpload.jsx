import React, { useRef, useState } from "react";
import { Camera, Loader2, X, User, Heart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "./primitives";

/**
 * ProfileImageUpload - A reusable profile image component with upload capability
 * 
 * @param {Object} props
 * @param {string} props.imageUrl - Current profile image URL
 * @param {string} props.entityId - ID of the entity (client or caregiver)
 * @param {string} props.entityType - Type of entity: "client" or "caregiver"
 * @param {function} props.onUpload - Callback function after successful upload, receives the new image URL
 * @param {boolean} props.readOnly - If true, disables upload functionality
 * @param {string} props.size - Size variant: "sm", "md", "lg" (default: "lg")
 * @param {string} props.className - Additional CSS classes
 */
export default function ProfileImageUpload({
  imageUrl,
  entityId,
  entityType = "client",
  onUpload,
  readOnly = false,
  size = "lg",
  className = "",
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const fileInputRef = useRef(null);

  const sizeClasses = {
    sm: "h-10 w-10 rounded-xl",
    md: "h-14 w-14 rounded-2xl",
    lg: "h-20 w-20 rounded-3xl",
  };

  const iconSizes = {
    sm: "h-5 w-5",
    md: "h-7 w-7",
    lg: "h-10 w-10",
  };

  const cameraIconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const bucketName = "profile-images";
  const FallbackIcon = entityType === "client" ? User : Heart;

  const handleFileSelect = () => {
    if (readOnly || isUploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      alert("Please upload a JPG, PNG, or WebP image.");
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("Image must be smaller than 5MB.");
      return;
    }

    setIsUploading(true);

    try {
      // Get file extension
      const ext = file.name.split(".").pop().toLowerCase();
      const filePath = `${entityType}s/${entityId}/profile.${ext}`;

      // Delete existing profile image if it exists (try to remove old format files)
      if (imageUrl) {
        try {
          const url = new URL(imageUrl);
          const pathParts = url.pathname.split('/');
          const storagePath = pathParts.slice(pathParts.indexOf('profile-images') + 1).join('/').split('?')[0];
          if (storagePath) {
            await supabase.storage.from(bucketName).remove([storagePath]);
          }
        } catch (e) {
          // Ignore errors when removing old image
        }
      }

      // Upload new image
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, { upsert: true });

      if (error) throw error;

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      // Add a cache-busting parameter to force refresh
      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Call the onUpload callback with the new URL
      if (onUpload) {
        await onUpload(newUrl);
      }
    } catch (error) {
      console.error("Error uploading profile image:", error);
      alert("Failed to upload image. Please try again.");
    }

    setIsUploading(false);
    setShowActions(false);
    // Reset file input
    e.target.value = "";
  };

  const handleRemove = async () => {
    if (readOnly || !imageUrl) return;

    setIsRemoving(true);

    try {
      // Extract the file path from the URL
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/');
      const storagePath = pathParts.slice(pathParts.indexOf('profile-images') + 1).join('/').split('?')[0];

      // Delete from storage
      if (storagePath) {
        await supabase.storage.from(bucketName).remove([storagePath]);
      }

      // Call the onUpload callback with null to clear the URL
      if (onUpload) {
        await onUpload(null);
      }
    } catch (error) {
      console.error("Error removing profile image:", error);
      alert("Failed to remove image. Please try again.");
    }

    setIsRemoving(false);
    setShowActions(false);
  };

  const isLoading = isUploading || isRemoving;

  return (
    <div
      className={cn("relative", className)}
      onMouseEnter={() => !readOnly && setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Avatar container */}
      <div
        className={cn(
          "relative flex items-center justify-center border border-white/10 bg-client-avatar shadow-[0_24px_45px_-28px_rgba(96,255,168,0.35)] overflow-hidden",
          sizeClasses[size],
          !readOnly && "cursor-pointer"
        )}
        onClick={handleFileSelect}
      >
        {/* Background gradient effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand/40 via-transparent to-aqua-600/40 blur-xl" />

        {/* Loading state */}
        {isLoading ? (
          <Loader2 className={cn("relative animate-spin text-icon-primary", iconSizes[size])} />
        ) : imageUrl ? (
          /* Profile image */
          <img
            src={imageUrl}
            alt="Profile"
            className="relative w-full h-full object-cover"
          />
        ) : (
          /* Fallback icon */
          <FallbackIcon className={cn("relative text-icon-primary", iconSizes[size])} />
        )}

        {/* Hover overlay for upload */}
        {!readOnly && !isLoading && (
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity duration-200",
              showActions ? "opacity-100" : "opacity-0"
            )}
          >
            <Camera className={cn("text-white", cameraIconSizes[size])} />
          </div>
        )}
      </div>

      {/* Remove button - only show if there's an image and not read-only */}
      {!readOnly && imageUrl && !isLoading && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRemove();
          }}
          className={cn(
            "absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg z-10 border-2 border-[rgb(var(--bg))]",
            showActions ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
          )}
          title="Remove photo"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
