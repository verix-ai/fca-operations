import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function FilePreviewModal({
    isOpen,
    onClose,
    filePath,
    fileName,
    title,
    storageBucket = 'caregiver-documents'
}) {
    const [fileUrl, setFileUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const fileExtension = filePath?.split('.').pop()?.toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);
    const isPdf = fileExtension === 'pdf';

    useEffect(() => {
        if (!isOpen || !filePath) return;

        const fetchSignedUrl = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const { data, error: signedUrlError } = await supabase.storage
                    .from(storageBucket)
                    .createSignedUrl(filePath, 3600); // 1 hour expiry

                if (signedUrlError) throw signedUrlError;
                setFileUrl(data.signedUrl);
            } catch (err) {
                console.error('Error getting signed URL:', err);
                setError('Failed to load file. Please try again.');
            }

            setIsLoading(false);
        };

        fetchSignedUrl();
    }, [isOpen, filePath, storageBucket]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const content = (
        <div className="fixed inset-0 z-[1000]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl border border-[rgba(147,165,197,0.25)] bg-hero-card shadow-[0_25px_60px_-30px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/5">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-heading-primary font-semibold truncate">
                                {title || fileName}
                            </h3>
                            {title && fileName && (
                                <p className="text-xs text-heading-subdued mt-0.5 truncate">
                                    {fileName}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                            {fileUrl && (
                                <a
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-lg text-heading-subdued hover:text-brand hover:bg-brand/10 transition-colors"
                                    title="Open in new tab"
                                >
                                    <ExternalLink className="w-5 h-5" />
                                </a>
                            )}
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg text-heading-subdued hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[300px]">
                        {isLoading ? (
                            <div className="flex flex-col items-center gap-3 text-heading-subdued">
                                <Loader2 className="w-8 h-8 animate-spin" />
                                <span className="text-sm">Loading file...</span>
                            </div>
                        ) : error ? (
                            <div className="text-center text-red-400">
                                <p>{error}</p>
                            </div>
                        ) : fileUrl ? (
                            <>
                                {isImage && (
                                    <img
                                        src={fileUrl}
                                        alt={fileName || title}
                                        className="max-w-full max-h-[calc(90vh-120px)] object-contain rounded-lg"
                                    />
                                )}
                                {isPdf && (
                                    <>
                                        {/* Mobile: iframes render PDFs at native resolution (zoomed-in
                                            and unscrollable). Show a prominent "Open Document" button
                                            that hands the PDF off to the OS viewer (Safari Quick Look /
                                            Chrome's PDF viewer), which handles fit-to-width correctly. */}
                                        <div className="md:hidden flex flex-col items-center gap-4 py-12 text-center w-full">
                                            <p className="text-sm text-heading-subdued max-w-xs">
                                                Tap below to view this document in your device&apos;s viewer.
                                            </p>
                                            <a
                                                href={fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-brand text-black font-medium hover:bg-brand/90 transition-colors"
                                            >
                                                <ExternalLink className="w-5 h-5" />
                                                Open Document
                                            </a>
                                        </div>
                                        {/* Desktop: inline iframe with FitH so the PDF opens fitted to
                                            the iframe width instead of native resolution. */}
                                        <iframe
                                            src={`${fileUrl}#view=FitH&toolbar=1`}
                                            title={fileName || title}
                                            className="hidden md:block w-full h-[calc(90vh-120px)] rounded-lg border-0"
                                        />
                                    </>
                                )}
                                {!isImage && !isPdf && (
                                    <div className="text-center text-heading-subdued">
                                        <p className="mb-4">This file type cannot be previewed directly.</p>
                                        <a
                                            href={fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand text-black font-medium hover:bg-brand/90 transition-colors"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Open in new tab
                                        </a>
                                    </div>
                                )}
                            </>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
}
