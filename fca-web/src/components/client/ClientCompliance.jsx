import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, FileText, Download, Printer, X, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const LEFT_SIDE_ITEMS = [
  { id: "care_plan", label: "Client Care Plan / Service Plan" },
  { id: "medication_profile", label: "Medication Profile" },
  { id: "diagnosis_list", label: "Full Client Diagnosis List" },
  { id: "disaster_plan", label: "Disaster Plan Triage Level" },
  { id: "discharge_planning", label: "Discharge Planning" },
  { id: "rn_assessment", label: "RN Assessment Report" },
];

const RIGHT_SIDE_ITEMS = [
  { id: "service_agreement", label: "Service Agreement" },
  { id: "medicaid_confirmation", label: "Medicaid Document Confirmation Form" },
  { id: "admission_services", label: "Admission to Services" },
  { id: "transportation_policy", label: "Medicaid Waiver Program Transportation Policy" },
  { id: "supervision_services", label: "Required Supervision of Services" },
  { id: "service_policies", label: "Friendly Care Agency, LLC Service Policies" },
  { id: "client_rights", label: "Statement of Client's Rights" },
  { id: "client_responsibilities", label: "Statement of Client's Responsibilities" },
  { id: "consent_services", label: "Consent To Personal Support Services Emergency Treatment, Release of Information and Statement to Remit" },
  { id: "appendix_l", label: "Appendix L" },
  { id: "client_representative", label: "Designation of Client Representative Advance Directives" },
];

export default function ClientCompliance({ client, onUpdate, readOnly = false }) {
  const [complianceData, setComplianceData] = useState({});
  const [uploadingItem, setUploadingItem] = useState(null);
  const [leftSideMode, setLeftSideMode] = useState("download"); // "download" or "print"
  const [rightSideMode, setRightSideMode] = useState("download");
  const [isProcessingLeft, setIsProcessingLeft] = useState(false);
  const [isProcessingRight, setIsProcessingRight] = useState(false);
  const fileInputRef = useRef(null);
  const currentUploadItem = useRef(null);
  const currentUploadSide = useRef(null);

  useEffect(() => {
    if (client?.compliance_data) {
      setComplianceData(client.compliance_data || {});
    }
  }, [client]);

  const saveComplianceData = async (newData) => {
    if (readOnly || !onUpdate) return;
    try {
      await onUpdate({
        compliance_data: newData,
      });
    } catch (error) {
      console.error("Error saving compliance data:", error);
    }
  };

  const handleCheckChange = (itemId, checked) => {
    const newData = {
      ...complianceData,
      [itemId]: {
        ...complianceData[itemId],
        checked: checked,
      },
    };
    setComplianceData(newData);
    saveComplianceData(newData);
  };

  const triggerFileUpload = (itemId, side) => {
    if (readOnly) return;
    currentUploadItem.current = itemId;
    currentUploadSide.current = side;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUploadItem.current) return;

    const itemId = currentUploadItem.current;
    const side = currentUploadSide.current;
    
    // Validate file type
    const validTypes = ["application/pdf", "image/jpeg", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      alert("Please upload a PDF or JPG file.");
      return;
    }

    setUploadingItem(itemId);
    
    try {
      // Get file extension
      const ext = file.name.split(".").pop().toLowerCase();
      const filePath = `${client.id}/compliance/${side}/${itemId}.${ext}`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("client-documents")
        .upload(filePath, file, { upsert: true });

      if (error) throw error;

      // Update compliance data with file info
      const newData = {
        ...complianceData,
        [itemId]: {
          ...complianceData[itemId],
          checked: true,
          filePath: filePath,
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
        },
      };
      setComplianceData(newData);
      saveComplianceData(newData);
      
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file. Please try again.");
    }
    
    setUploadingItem(null);
    currentUploadItem.current = null;
    currentUploadSide.current = null;
    // Reset file input
    e.target.value = "";
  };

  const removeFile = async (itemId) => {
    if (readOnly) return;
    
    const itemData = complianceData[itemId];
    if (!itemData?.filePath) return;

    try {
      // Delete from storage
      await supabase.storage
        .from("client-documents")
        .remove([itemData.filePath]);

      // Update compliance data
      const newData = {
        ...complianceData,
        [itemId]: {
          ...complianceData[itemId],
          filePath: null,
          fileName: null,
          uploadedAt: null,
        },
      };
      setComplianceData(newData);
      saveComplianceData(newData);
    } catch (error) {
      console.error("Error removing file:", error);
    }
  };

  const getFilesForSide = (side) => {
    const items = side === "left" ? LEFT_SIDE_ITEMS : RIGHT_SIDE_ITEMS;
    return items
      .filter(item => complianceData[item.id]?.filePath)
      .map(item => ({
        ...item,
        ...complianceData[item.id],
      }));
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
          .from("client-documents")
          .download(file.filePath);
        
        if (error) {
          console.error(`Error downloading ${file.fileName}:`, error);
          continue;
        }

        const ext = file.filePath.split(".").pop();
        zip.file(`${file.label}.${ext}`, data);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const sideName = side === "left" ? "Clinical" : "Service_Documents";
      saveAs(content, `${client.client_name}_${sideName}_Compliance.zip`);
      
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

      // Build HTML content with embedded images
      let pagesHtml = "";
      
      for (const file of files) {
        const { data, error } = await supabase.storage
          .from("client-documents")
          .download(file.filePath);
        
        if (error) {
          console.error(`Error downloading ${file.fileName}:`, error);
          continue;
        }

        const ext = file.filePath.split(".").pop().toLowerCase();
        
        if (ext === "pdf") {
          // For PDFs, convert to base64 data URL
          const base64 = await blobToBase64(data);
          pagesHtml += `
            <div class="page">
              <div class="page-header">
                <h2>${file.label}</h2>
                <div class="client-name">${client.client_name}</div>
              </div>
              <div class="content-container">
                <embed src="${base64}" type="application/pdf" />
              </div>
            </div>
          `;
        } else {
          // For images, convert to base64 data URL
          const blob = new Blob([data], { type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
          const base64 = await blobToBase64(blob);
          pagesHtml += `
            <div class="page">
              <div class="page-header">
                <h2>${file.label}</h2>
                <div class="client-name">${client.client_name}</div>
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
        
        .page-header .client-name {
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

      // Create a hidden iframe for printing
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
            <title>${client.client_name} - ${side === "left" ? "Clinical" : "Service Documents"} Compliance</title>
            <style>${printStyles}</style>
          </head>
          <body>
            ${pagesHtml}
          </body>
        </html>
      `);
      iframeDoc.close();

      // Wait for images to load, then print
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        
        // Clean up iframe after printing
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

  // Helper function to convert blob to base64
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

  const renderChecklistItem = (item, side) => {
    const itemData = complianceData[item.id] || {};
    const isChecked = itemData.checked || false;
    const hasFile = !!itemData.filePath;
    const isUploading = uploadingItem === item.id;
    
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
            <span className="text-xs text-brand flex items-center gap-1 mt-1">
              <FileText className="w-3 h-3" />
              {itemData.fileName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {hasFile && !readOnly && (
            <button
              onClick={() => removeFile(item.id)}
              className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {!readOnly && (
            <button
              onClick={() => triggerFileUpload(item.id, side)}
              disabled={isUploading}
              className={`p-1.5 rounded-lg transition-colors ${
                hasFile 
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
        {/* Toggle Switch */}
        <div className="flex items-center bg-black/20 rounded-full p-1">
          <button
            onClick={() => setMode("download")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              mode === "download" 
                ? "bg-brand text-black" 
                : "text-heading-subdued hover:text-heading-primary"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
          <button
            onClick={() => setMode("print")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              mode === "print" 
                ? "bg-brand text-black" 
                : "text-heading-subdued hover:text-heading-primary"
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>

        {/* Action Button */}
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
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Side Card */}
        <Card className="bg-hero-card border-white/10 rounded-3xl h-full flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-heading-subdued uppercase tracking-wider">
              Left Side of Client Folder - Clinical
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
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
              Right Side of Client Folder - Service Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
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
