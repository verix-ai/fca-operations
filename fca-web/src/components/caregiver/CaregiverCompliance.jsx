import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, FileText, Download, Printer, X, Check, Eye, Plus, Camera } from "lucide-react";
import DocumentScanner from "@/components/scanner/DocumentScanner";
import { uploadComplianceDoc } from "@/lib/uploadComplianceDoc";
import { confirm } from "@/components/ui/confirm-dialog";
import FilePreviewModal from "@/components/ui/FilePreviewModal";
import { supabase } from "@/lib/supabase";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { COMPLIANCE_ONBOARDING_MAP } from "@/constants/caregiver";

const LEFT_SIDE_ITEMS = [
  { id: "drivers_license", label: "Driver License" },
  { id: "social_security_card", label: "Social Security Card (Or Birth Certificate)" },
  { id: "finger_printing", label: "Finger Printing (w/final registration form)" },
  { id: "tb_skin_test", label: "TB Skin Test" },
];

const RIGHT_SIDE_ITEMS = [
  { id: "pca_test", label: "GACCP PCA Test Part 1-3" },
  { id: "cpr_first_aid", label: "CPR-First Aid-AED" },
  { id: "application_toc", label: "Application Package Table Of Contents" },
  { id: "job_description", label: "Companion Sitter / Personal Care Assistant Job Description" },
  { id: "policy_acknowledgements", label: "Definitions Statements parts of policy Acknowledgements" },
  { id: "dress_code_policy", label: "Employee (Team Member) Dress Code Policy" },
  { id: "code_of_ethics", label: "Employee (Team Member) Code Of Ethics Policy" },
  { id: "employment_application", label: "Employment (Team Member) Application" },
  { id: "form_i9", label: "Form I-9" },
  { id: "form_g4", label: "G-4" },
  { id: "hepatitis_b", label: "Hepatitis B Vaccine Acceptance/Declination" },
  { id: "client_rights_responsibilities", label: "Individuals – Clients Right and Responsibilities Policy" },
  { id: "payroll_deduction", label: "Payroll Deduction Authorization Form" },
  { id: "policy_acknowledgment", label: "Policy Acknowledgment" },
  { id: "scope_of_services", label: "Scope Of Services" },
  { id: "orientation_checklist", label: "Staff Orientation Checklist" },
  { id: "abuse_neglect_statement", label: "Statement of Abuse, Neglect, Exploitation, Misconduct" },
  { id: "tb_hepatitis_clearance", label: "TB Hepatitis Exposure Reporting and Clearance" },
  { id: "form_w4", label: "W-4" },
  { id: "caregiver_training", label: "Caregiver Training", isMulti: true },
];

export default function CaregiverCompliance({ caregiver, onUpdate, readOnly = false }) {
  const [complianceData, setComplianceData] = useState({});
  const [uploadingItem, setUploadingItem] = useState(null);
  const [leftSideMode, setLeftSideMode] = useState("download");
  const [rightSideMode, setRightSideMode] = useState("download");
  const [isProcessingLeft, setIsProcessingLeft] = useState(false);
  const [isProcessingRight, setIsProcessingRight] = useState(false);
  const fileInputRef = useRef(null);
  const currentUploadItem = useRef(null);
  const currentUploadSide = useRef(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [scannerCategory, setScannerCategory] = useState(null); // { itemId, side, label } | null

  useEffect(() => {
    if (caregiver?.compliance_data) {
      setComplianceData(caregiver.compliance_data || {});
    }
  }, [caregiver]);



  const handleCheckChange = (itemId, checked) => {
    const newData = {
      ...complianceData,
      [itemId]: {
        ...complianceData[itemId],
        checked: checked,
      },
    };
    setComplianceData(newData);

    // Sync with Onboarding Checklist
    const onboardingField = COMPLIANCE_ONBOARDING_MAP[itemId];
    const updates = { compliance_data: newData };

    if (onboardingField) {
      updates[onboardingField] = checked;
    }

    saveComplianceData(updates);
  };

  const saveComplianceData = async (updates) => {
    if (readOnly || !onUpdate) return;
    try {
      await onUpdate(updates);
    } catch (error) {
      console.error("Error saving compliance data:", error);
    }
  };

  const triggerFileUpload = (itemId, side) => {
    if (readOnly) return;
    currentUploadItem.current = itemId;
    currentUploadSide.current = side;
    fileInputRef.current?.click();
  };

  const performUpload = async (file, itemId, side) => {
    setUploadingItem(itemId);
    try {
      const isMulti = side === "right" && itemId === "caregiver_training";

      if (isMulti) {
        // Multi-file upload: build a unique file path with timestamp to avoid collisions
        const ext = file.name.split(".").pop().toLowerCase();
        const timestamp = Date.now();
        const filePath = `${caregiver.id}/compliance/${side}/${itemId}_${timestamp}.${ext}`;

        const { error } = await supabase.storage
          .from("caregiver-documents")
          .upload(filePath, file, { upsert: true });

        if (error) throw error;

        const existingFiles = complianceData[itemId]?.files || [];
        const newFileEntry = {
          id: `${timestamp}`,
          filePath: filePath,
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
          label: `Training Record - ${new Date().toLocaleDateString()}`,
        };

        const newData = {
          ...complianceData,
          [itemId]: {
            ...complianceData[itemId],
            checked: true,
            files: [...existingFiles, newFileEntry],
          },
        };
        setComplianceData(newData);
        const updates = { compliance_data: newData };
        const onboardingField = COMPLIANCE_ONBOARDING_MAP[itemId];
        if (onboardingField) updates[onboardingField] = true;
        saveComplianceData(updates);
      } else {
        // Standard single-file upload via shared helper
        const meta = await uploadComplianceDoc(supabase, {
          bucket: "caregiver-documents",
          ownerId: caregiver.id,
          side,
          itemId,
          file,
        });
        const newData = {
          ...complianceData,
          [itemId]: {
            ...complianceData[itemId],
            checked: true,
            ...meta,
          },
        };
        setComplianceData(newData);
        const updates = { compliance_data: newData };
        const onboardingField = COMPLIANCE_ONBOARDING_MAP[itemId];
        if (onboardingField) updates[onboardingField] = true;
        saveComplianceData(updates);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      alert(error?.message || "Failed to upload file. Please try again.");
    }
    setUploadingItem(null);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUploadItem.current) return;
    const itemId = currentUploadItem.current;
    const side = currentUploadSide.current;
    if (!["application/pdf", "image/jpeg", "image/jpg"].includes(file.type)) {
      alert("Please upload a PDF or JPG file.");
      e.target.value = "";
      return;
    }
    await performUpload(file, itemId, side);
    currentUploadItem.current = null;
    currentUploadSide.current = null;
    e.target.value = "";
  };

  const triggerScan = (itemId, side, label) => {
    if (readOnly) return;
    setScannerCategory({ itemId, side, label });
  };

  const handleScanComplete = async (pdfFile) => {
    if (!scannerCategory) return;
    const { itemId, side, label } = scannerCategory;
    const existing = complianceData[itemId]?.filePath;
    if (existing) {
      const ok = await confirm({
        title: `Replace existing ${label}?`,
        description: "This will replace the document already on file.",
        confirmText: "Replace",
        cancelText: "Cancel",
      });
      if (!ok) {
        setScannerCategory(null);
        return;
      }
    }
    await performUpload(pdfFile, itemId, side);
    setScannerCategory(null);
  };

  const removeFile = async (itemId, fileEntryId = null) => {
    if (readOnly) return;

    const itemData = complianceData[itemId];

    // Determine path to delete
    let filePathToDelete;
    if (fileEntryId && itemData?.files) {
      const fileEntry = itemData.files.find(f => f.id === fileEntryId);
      filePathToDelete = fileEntry?.filePath;
    } else {
      filePathToDelete = itemData?.filePath;
    }

    if (!filePathToDelete) return;

    try {
      await supabase.storage
        .from("caregiver-documents")
        .remove([filePathToDelete]);

      let newData;
      if (fileEntryId && itemData?.files) {
        // Remove specific file from multi-item list
        const updatedFiles = itemData.files.filter(f => f.id !== fileEntryId);
        newData = {
          ...complianceData,
          [itemId]: {
            ...itemData,
            files: updatedFiles,
            // Uncheck if no files left? Optional. Let's keep it checked if user manually checked it.
            // But if it was auto-checked, maybe we leave it? 
            // For now, simple removal.
          }
        };
      } else {
        // Remove single file
        newData = {
          ...complianceData,
          [itemId]: {
            ...complianceData[itemId],
            filePath: null,
            fileName: null,
            uploadedAt: null,
          },
        };
      }

      setComplianceData(newData);
      saveComplianceData(newData);
    } catch (error) {
      console.error("Error removing file:", error);
    }
  };

  const getFilesForSide = (side) => {
    const items = side === "left" ? LEFT_SIDE_ITEMS : RIGHT_SIDE_ITEMS;
    const files = [];

    items.forEach(item => {
      const itemData = complianceData[item.id];
      if (!itemData) return;

      if (item.isMulti && itemData.files && itemData.files.length > 0) {
        // Add all files from multi-item
        itemData.files.forEach((file, index) => {
          files.push({
            id: `${item.id}_${file.id}`,
            label: `${item.label} (${index + 1})`, // or file.label
            filePath: file.filePath,
            fileName: file.fileName
          });
        });
      } else if (itemData.filePath) {
        // Add single file
        files.push({
          ...item,
          ...itemData
        });
      }
    });

    return files;
  };

  const handleDownload = async (side) => {
    const setProcessing = side === "left" ? setIsProcessingLeft : setIsProcessingRight;
    setProcessing(true);

    try {
      const files = getFilesForSide(side);
      if (files.length === 0) {
        alert("No files to download for this side.");
        setProcessing(false);
        return;
      }

      const zip = new JSZip();

      for (const file of files) {
        const { data, error } = await supabase.storage
          .from("caregiver-documents")
          .download(file.filePath);

        if (error) {
          console.error(`Error downloading ${file.fileName}:`, error);
          continue;
        }

        const ext = file.filePath.split(".").pop();
        zip.file(`${file.label}.${ext}`, data);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const sideName = side === "left" ? "Left_Side" : "Right_Side";
      saveAs(content, `${caregiver.full_name}_${sideName}_Compliance.zip`);

    } catch (error) {
      console.error("Error creating download:", error);
      alert("Failed to create download. Please try again.");
    }

    setProcessing(false);
  };

  const handlePrint = async (side) => {
    const setProcessing = side === "left" ? setIsProcessingLeft : setIsProcessingRight;
    setProcessing(true);

    try {
      const files = getFilesForSide(side);
      if (files.length === 0) {
        alert("No files to print for this side.");
        setProcessing(false);
        return;
      }

      let pagesHtml = "";

      for (const file of files) {
        const { data, error } = await supabase.storage
          .from("caregiver-documents")
          .download(file.filePath);

        if (error) {
          console.error(`Error downloading ${file.fileName}:`, error);
          continue;
        }

        const ext = file.filePath.split(".").pop().toLowerCase();

        if (ext === "pdf") {
          const base64 = await blobToBase64(data);
          pagesHtml += `
            <div class="page">
              <div class="page-header">
                <h2>${file.label}</h2>
                <div class="caregiver-name">${caregiver.full_name}</div>
              </div>
              <div class="content-container">
                <embed src="${base64}" type="application/pdf" />
              </div>
            </div>
          `;
        } else {
          const blob = new Blob([data], { type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
          const base64 = await blobToBase64(blob);
          pagesHtml += `
            <div class="page">
              <div class="page-header">
                <h2>${file.label}</h2>
                <div class="caregiver-name">${caregiver.full_name}</div>
              </div>
              <div class="content-container">
                <img src="${base64}" alt="${file.label}" />
              </div>
            </div>
          `;
        }
      }

      const printStyles = `
        @page {
          size: letter;
          margin: 0.5in;
        }
        
        * {
          box-sizing: border-box;
        }
        
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          background: white;
        }
        
        .page {
          width: 7.5in;
          height: 10in;
          background: white;
          page-break-after: always;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 0.25in;
          position: relative;
        }
        
        .page:last-child {
          page-break-after: auto;
        }
        
        .page-header {
          width: 100%;
          text-align: center;
          margin-bottom: 0.25in;
          padding-bottom: 0.15in;
          border-bottom: 1px solid #ccc;
        }
        
        .page-header h2 {
          margin: 0;
          font-size: 14pt;
          color: #333;
          font-weight: 600;
        }
        
        .page-header .caregiver-name {
          font-size: 10pt;
          color: #666;
          margin-top: 4px;
        }
        
        .content-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-height: 9in;
          overflow: hidden;
        }
        
        .content-container img {
          max-width: 100%;
          max-height: 9in;
          width: auto;
          height: auto;
          object-fit: contain;
        }
        
        .content-container embed,
        .content-container iframe {
          width: 100%;
          height: 9in;
          border: none;
        }
        
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .page {
            margin: 0;
            box-shadow: none;
          }
        }
      `;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${caregiver.full_name} - ${side === "left" ? "Left Side" : "Right Side"} Compliance</title>
            <style>${printStyles}</style>
          </head>
          <body>
            ${pagesHtml}
          </body>
        </html>
      `);
      iframeDoc.close();

      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();

        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 1000);

    } catch (error) {
      console.error("Error preparing print:", error);
      alert("Failed to prepare print. Please try again.");
    }

    setProcessing(false);
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleAction = (side) => {
    const mode = side === "left" ? leftSideMode : rightSideMode;
    if (mode === "download") {
      handleDownload(side);
    } else {
      handlePrint(side);
    }
  };

  const handleSelectAll = (side, checked) => {
    if (readOnly) return;
    const items = side === "left" ? LEFT_SIDE_ITEMS : RIGHT_SIDE_ITEMS;

    // Create new compliance data object starting with current state
    const newComplianceData = { ...complianceData };
    const updates = {};

    items.forEach(item => {
      newComplianceData[item.id] = {
        ...(complianceData[item.id] || {}),
        checked: checked
      };

      // Sync with Onboarding Checklist map
      const onboardingField = COMPLIANCE_ONBOARDING_MAP[item.id];
      if (onboardingField) {
        updates[onboardingField] = checked;
      }
    });

    setComplianceData(newComplianceData);
    updates.compliance_data = newComplianceData;

    saveComplianceData(updates);
  };

  const renderChecklistItem = (item, side) => {
    const itemData = complianceData[item.id] || {};
    const isChecked = itemData.checked || false;
    const isUploading = uploadingItem === item.id;

    // Multi-file item rendering (Caregiver Training)
    if (item.isMulti) {
      const files = itemData.files || [];

      return (
        <div key={item.id} className="flex flex-col gap-2 py-2 group">
          <div className="flex items-start gap-3">
            <Checkbox
              id={item.id}
              checked={isChecked}
              onCheckedChange={(checked) => handleCheckChange(item.id, checked)}
              disabled={readOnly}
              className="mt-0.5 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <Label
                htmlFor={item.id}
                className="text-sm text-heading-subdued cursor-pointer leading-tight block font-medium"
              >
                {item.label}
              </Label>
            </div>
            {!readOnly && (
              <button
                onClick={() => triggerFileUpload(item.id, side)}
                disabled={isUploading}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-brand/10 text-brand hover:bg-brand/20 transition-colors"
                title="Add another training record"
              >
                {isUploading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                Add Record
              </button>
            )}
          </div>

          {/* List of uploaded files */}
          <div className="pl-8 space-y-1">
            {files.map((file, index) => (
              <div key={file.id} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-white/5 group/file">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-heading-subdued w-4">{index + 1}.</span>
                  <button
                    onClick={() => setPreviewFile({ filePath: file.filePath, fileName: file.fileName, title: `${item.label} - ${file.fileName}` })}
                    className="flex items-center gap-1.5 text-brand hover:underline truncate"
                  >
                    <Eye className="w-3 h-3 shrink-0" />
                    <span className="truncate">{file.fileName}</span>
                  </button>
                </div>
                {!readOnly && (
                  <button
                    onClick={() => removeFile(item.id, file.id)}
                    className="p-1 text-heading-subdued hover:text-red-400 opacity-100 md:opacity-0 md:group-hover/file:opacity-100 transition-opacity"
                    title="Remove this record"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {files.length === 0 && (
              <div className="text-xs text-heading-subdued italic">
                No training records uploaded yet.
              </div>
            )}
          </div>
        </div>
      );
    }

    // Standard single-file item rendering
    const hasFile = !!itemData.filePath;

    return (
      <div key={item.id} className="flex items-start gap-3 py-2 group">
        <Checkbox
          id={item.id}
          checked={isChecked}
          onCheckedChange={(checked) => handleCheckChange(item.id, checked)}
          disabled={readOnly}
          className="mt-0.5 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <Label
            htmlFor={item.id}
            className="text-sm text-heading-subdued cursor-pointer leading-tight block"
          >
            {item.label}
          </Label>
          {hasFile && (
            <button
              onClick={() => setPreviewFile({ filePath: itemData.filePath, fileName: itemData.fileName, title: item.label })}
              className="text-xs text-brand flex items-center gap-2 mt-1 hover:underline cursor-pointer bg-transparent border-none p-0"
            >
              <Eye className="w-3 h-3" />
              {itemData.fileName}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {hasFile && !readOnly && (
            <button
              onClick={() => removeFile(item.id)}
              className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {!readOnly && (
            <>
              <button
                onClick={() => triggerFileUpload(item.id, side)}
                disabled={isUploading}
                className={`p-1.5 rounded-lg transition-colors ${hasFile
                  ? "text-brand bg-brand/10"
                  : "text-heading-subdued hover:text-brand hover:bg-brand/10"
                  }`}
                title={hasFile ? "Replace file" : "Upload file"}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : hasFile ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => triggerScan(item.id, side, item.label)}
                disabled={isUploading}
                className="p-1.5 rounded-lg transition-colors text-heading-subdued hover:text-brand hover:bg-brand/10"
                title="Scan document"
              >
                <Camera className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderSideActions = (side) => {
    const mode = side === "left" ? leftSideMode : rightSideMode;
    const setMode = side === "left" ? setLeftSideMode : setRightSideMode;
    const isProcessing = side === "left" ? isProcessingLeft : isProcessingRight;
    const files = getFilesForSide(side);
    const hasFiles = files.length > 0;

    return (
      <div className="flex items-center gap-3 mt-auto pt-4 border-t border-white/10">
        <div className="flex items-center bg-black/20 rounded-full p-1">
          <button
            onClick={() => setMode("download")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${mode === "download"
              ? "bg-brand text-black"
              : "text-heading-subdued hover:text-heading-primary"
              }`}
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
          <button
            onClick={() => setMode("print")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${mode === "print"
              ? "bg-brand text-black"
              : "text-heading-subdued hover:text-heading-primary"
              }`}
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>

        <Button
          onClick={() => handleAction(side)}
          disabled={isProcessing || !hasFiles}
          size="sm"
          className="rounded-full px-4"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              {mode === "download" ? "Zipping..." : "Preparing..."}
            </>
          ) : (
            <>
              {mode === "download" ? (
                <Download className="w-4 h-4 mr-2" />
              ) : (
                <Printer className="w-4 h-4 mr-2" />
              )}
              {mode === "download" ? "Download ZIP" : "Print All"}
            </>
          )}
        </Button>

        {!hasFiles && (
          <span className="text-xs text-heading-subdued">No files uploaded</span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg"
        onChange={handleFileChange}
        className="hidden"
      />

      <FilePreviewModal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        filePath={previewFile?.filePath}
        fileName={previewFile?.fileName}
        title={previewFile?.title}
        storageBucket="caregiver-documents"
      />

      {scannerCategory && (
        <DocumentScanner
          isOpen
          onClose={() => setScannerCategory(null)}
          onComplete={handleScanComplete}
          categoryName={scannerCategory.label}
        />
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Side Card */}
        <Card className="bg-hero-card border-white/10 rounded-3xl h-full flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-heading-subdued uppercase tracking-wider">
              Left Side of Caregiver Folder
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="flex items-center gap-3 py-2 border-b border-white/10 mb-2">
              <Checkbox
                id="select-all-left"
                checked={LEFT_SIDE_ITEMS.every(item => complianceData[item.id]?.checked)}
                onCheckedChange={(checked) => handleSelectAll("left", checked)}
                disabled={readOnly}
                className="mt-0.5 shrink-0"
              />
              <Label
                htmlFor="select-all-left"
                className="text-sm font-medium cursor-pointer leading-tight block text-heading-primary"
              >
                Select All
              </Label>
            </div>
            <div className="space-y-1">
              {LEFT_SIDE_ITEMS.map(item => renderChecklistItem(item, "left"))}
            </div>
            {renderSideActions("left")}
          </CardContent>
        </Card>

        {/* Right Side Card */}
        <Card className="bg-hero-card border-white/10 rounded-3xl h-full flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-heading-subdued uppercase tracking-wider">
              Right Side of Caregiver Folder
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="flex items-center gap-3 py-2 border-b border-white/10 mb-2">
              <Checkbox
                id="select-all-right"
                checked={RIGHT_SIDE_ITEMS.every(item => complianceData[item.id]?.checked)}
                onCheckedChange={(checked) => handleSelectAll("right", checked)}
                disabled={readOnly}
                className="mt-0.5 shrink-0"
              />
              <Label
                htmlFor="select-all-right"
                className="text-sm font-medium cursor-pointer leading-tight block text-heading-primary"
              >
                Select All
              </Label>
            </div>
            <div className="space-y-1">
              {RIGHT_SIDE_ITEMS.map(item => renderChecklistItem(item, "right"))}
            </div>
            {renderSideActions("right")}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
