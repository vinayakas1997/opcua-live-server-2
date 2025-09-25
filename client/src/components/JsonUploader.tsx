import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Upload, FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import { type PLCConfig, type RawJSONData, rawJSONSchema } from "@shared/schema";
import { normalizePLCConfig } from "@shared/normalization";
import { api } from "@/lib/api";

interface JsonUploaderProps {
  onConfigUploaded: (config: PLCConfig) => void;
  onSuccess?: () => void;
  onClose?: () => void;
}

export default function JsonUploader({ onConfigUploaded, onSuccess, onClose }: JsonUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedConfig, setUploadedConfig] = useState<PLCConfig | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setError(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const validatedData = rawJSONSchema.parse(json);
      const normalizedPLCs = normalizePLCConfig(validatedData);

      // For now, take the first PLC for single config handling
      const firstNormalizedPLC = normalizedPLCs[0];
      if (firstNormalizedPLC) {
        const apiConfig: PLCConfig = {
          plc_name: firstNormalizedPLC.plc_name,
          plc_no: firstNormalizedPLC.plc_no, // Always include plc_no
          plc_ip: firstNormalizedPLC.plc_ip,
          opcua_url: firstNormalizedPLC.opcua_url,
          address_mappings: firstNormalizedPLC.variables
            .filter(v => !v.parentId) // Only parent variables
            .map(v => ({
              node_name: v.opcua_reg_add,
              node_id: v.id,
              description: v.description || undefined,
              data_type: v.data_type || undefined,
            })),
        };

        setUploadedConfig(apiConfig);
        setUploadedFile(file);
        console.log('JSON config validated and normalized successfully:', apiConfig);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to process file');
      }
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const jsonFile = files.find(file => file.type === 'application/json' || file.name.endsWith('.json'));
    
    if (jsonFile) {
      processFile(jsonFile);
    } else {
      setError('Please upload a valid JSON file');
    }
  }, [processFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleAddToList = async () => {
    if (uploadedConfig && uploadedFile) {
      try {
        // Use the direct JSON upload API to preserve metadata
        await api.uploadJSONConfig(uploadedFile);
        // PLC is already created by the upload API, just refresh and close
        setUploadedConfig(null);
        setUploadedFile(null);
        onSuccess?.();
        onClose?.();
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to upload configuration');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Upload PLC Configuration</h2>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-uploader">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {!uploadedConfig && (
        <Card
          className={`border-2 border-dashed transition-colors cursor-pointer ${
            isDragOver 
              ? "border-primary bg-primary/5" 
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          data-testid="area-file-drop"
        >
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              {isProcessing ? (
                <>
                  <div className="animate-spin mx-auto">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">Processing file...</p>
                </>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                  <div className="space-y-2">
                    <p className="text-lg font-medium">Drop your JSON file here</p>
                    <p className="text-muted-foreground">
                      or click to browse files
                    </p>
                  </div>
                  
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileInput}
                    className="hidden"
                    id="json-upload"
                    data-testid="input-file-upload"
                  />
                  <label htmlFor="json-upload">
                    <Button variant="outline" asChild>
                      <span>Browse Files</span>
                    </Button>
                  </label>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {uploadedConfig && (
        <Card data-testid="card-config-preview">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Configuration Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">PLC Name</label>
                <p className="font-mono text-sm">{uploadedConfig.plc_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">PLC Number</label>
                <p className="font-mono text-sm">{uploadedConfig.plc_no || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">IP Address</label>
                <p className="font-mono text-sm">{uploadedConfig.plc_ip}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">OPC UA URL</label>
                <p className="font-mono text-sm break-all">{uploadedConfig.opcua_url}</p>
              </div>
            </div>

            <Separator />

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Address Mappings ({uploadedConfig.address_mappings.length})
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {uploadedConfig.address_mappings.map((mapping, index) => (
                  <div key={index} className="border rounded-md p-3 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{mapping.node_name}</Badge>
                      {mapping.data_type && (
                        <Badge variant="secondary">{mapping.data_type}</Badge>
                      )}
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">{mapping.node_id}</p>
                    {mapping.description && (
                      <p className="text-xs text-muted-foreground mt-1">{mapping.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleAddToList} data-testid="button-add-to-list">
                Add to PLC List
              </Button>
              <Button variant="outline" onClick={() => {
                setUploadedConfig(null);
                setUploadedFile(null);
              }} data-testid="button-upload-another">
                Upload Another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}