import React, { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Eye, EyeOff, Edit2, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type NormalizedPLC, type NormalizedVariable } from "@shared/normalization";

interface EnhancedVariablesTableProps {
  plc: NormalizedPLC | null;
  onExportCSV?: () => void;
  onRefresh: () => void;
}

export default function EnhancedVariablesTable({ 
  plc,
  onExportCSV,
  onRefresh 
}: EnhancedVariablesTableProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVariables, setSelectedVariables] = useState<Set<string>>(new Set());
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [userDescriptions, setUserDescriptions] = useState<Map<string, string>>(new Map());
  const [editingDescriptions, setEditingDescriptions] = useState<Set<string>>(new Set());
  const [savingDescriptions, setSavingDescriptions] = useState<Set<string>>(new Set());
  const [tempValues, setTempValues] = useState<Map<string, string>>(new Map());

  // Get variables from plc, default to empty array if not available
  const variables = plc?.variables || [];

  // Debug logging for variable processing
  console.log('=== EnhancedVariablesTable Debug ===');
  console.log('PLC:', plc?.plc_name, 'PLC_NO:', plc?.plc_no);
  console.log('Raw variables from PLC:', variables);
  console.log('Raw variables count:', variables.length);

  // Transform variables to include expanded bit rows
  const transformedVariables = variables.flatMap(variable => {
    // Check if this is a bit-mapped channel (BC type with bit_mappings)
    if (variable.opcua_reg_add?.endsWith('_BC') && variable.metadata?.bit_mappings) {
      // Create separate rows for each bit mapping
      return Object.entries(variable.metadata.bit_mappings).map(([bitKey, bitData]: [string, any]) => {
        const bitNumber = bitData?.bit_position?.toString().padStart(2, '0') || '00';
        const bitName = variable.opcua_reg_add.replace('_BC', `_${bitNumber}`);

        return {
          ...variable,
          id: `${variable.id}_bit_${bitNumber}`,
          opcua_reg_add: bitName,
          plc_reg_add: `${variable.plc_reg_add}_${bitNumber}`,
          description: bitData?.description || `${variable.description} - Bit ${bitNumber}`,
          type: "bool" as const,
          isBitRow: true,
          parentId: variable.id,
          bitPosition: bitData?.bit_position || 0,
        };
      });
    }
    // Return original variable if not a bit-mapped channel
    return [variable];
  });

  const getParentVariables = (vars: NormalizedVariable[]) => {
    return vars.filter(v => v.type === "channel" || !v.parentId);
  };

  const getChildVariables = (vars: NormalizedVariable[], parentId: string) => {
    return vars.filter(v => v.parentId === parentId);
  };

  const parentVariables = getParentVariables(transformedVariables);

  console.log('Transformed variables:', transformedVariables);
  console.log('Transformed variables count:', transformedVariables.length);
  console.log('Parent variables:', parentVariables);
  console.log('Parent variables count:', parentVariables.length);

  // Filter variables based on search term and selection
  const filteredParentVariables = parentVariables.filter(variable => {
    // Check if variable is selected (parent or has selected children)
    const childVariables = getChildVariables(transformedVariables, variable.id);
    const hasSelectedChild = childVariables.some(child => selectedVariables.has(child.id));
    const isSelected = selectedVariables.has(variable.id) || hasSelectedChild;

    if (showSelectedOnly) {
      // When showing selected only, just check if variable is selected
      return isSelected;
    }

    // When not showing selected only, apply search filter
    if (!searchTerm) return true; // Show all when no search term

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      (variable.plc_reg_add?.toLowerCase() || '').includes(searchLower) ||
      (variable.opcua_reg_add?.toLowerCase() || '').includes(searchLower) ||
      (variable.description?.toLowerCase() || '').includes(searchLower);

    return matchesSearch;
  });

  console.log('Search term:', searchTerm);
  console.log('Show selected only:', showSelectedOnly);
  console.log('Filtered parent variables count:', filteredParentVariables.length);
  console.log('Final displayed variables:', filteredParentVariables);

  // Load user descriptions on component mount
  useEffect(() => {
    const loadUserDescriptions = async () => {
      try {
        const response = await fetch('/api/user-descriptions');
        if (response.ok) {
          const descriptions = await response.json();
          setUserDescriptions(descriptions);
        }
      } catch (error) {
        // Silently handle the error since this is expected in development
      }
    };

    loadUserDescriptions();
  }, []);


  const handleVariableSelect = (variableId: string, checked: boolean) => {
    const newSelected = new Set(selectedVariables);
    if (checked) {
      newSelected.add(variableId);
    } else {
      newSelected.delete(variableId);
    }
    setSelectedVariables(newSelected);
  };

  const handleChannelSelect = (channelId: string, checked: boolean) => {
    const newSelected = new Set(selectedVariables);
    const childVariables = getChildVariables(transformedVariables, channelId);
    
    if (checked) {
      newSelected.add(channelId);
      childVariables.forEach(child => newSelected.add(child.id));
    } else {
      newSelected.delete(channelId);
      childVariables.forEach(child => newSelected.delete(child.id));
    }
    setSelectedVariables(newSelected);
  };

  const getVariableValue = (variable: NormalizedVariable) => {
    // Mock value for demonstration
    if (variable.type === "bool") return "false";
    if (variable.type === "channel") return "N/A";
    return "N/A";
  };

  const getTimestamp = () => {
    return new Date().toLocaleTimeString('en-GB', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusBackgroundColor = (status: string) => {
    return "bg-green-50 dark:bg-green-950/20";
  };

  const renderUserDescriptionCell = (variable: NormalizedVariable) => {
    const isEditing = editingDescriptions.has(variable.id);
    const isSaving = savingDescriptions.has(variable.id);
    const userDescription = userDescriptions.get(variable.id) || "";
    const tempValue = tempValues.get(variable.id) || userDescription;

    const handleSave = async (newValue: string) => {
      setSavingDescriptions(prev => new Set(prev).add(variable.id));
      
      try {
        // Update the local state immediately
        setUserDescriptions(prev => new Map(prev).set(variable.id, newValue));
        
        // Here you would typically save to backend
        // await saveUserDescription(variable.id, newValue);
        
        toast({
          title: "Success",
          description: "Description saved successfully",
          variant: "default",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to save description",
          variant: "destructive",
        });
      } finally {
        setSavingDescriptions(prev => {
          const newSet = new Set(prev);
          newSet.delete(variable.id);
          return newSet;
        });
        setEditingDescriptions(prev => {
          const newSet = new Set(prev);
          newSet.delete(variable.id);
          return newSet;
        });
        setTempValues(prev => {
          const newMap = new Map(prev);
          newMap.delete(variable.id);
          return newMap;
        });
      }
    };

    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          <Input
            defaultValue={userDescription}
            className="h-8 text-xs"
            onChange={(e) => setTempValues(prev => new Map(prev).set(variable.id, e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSave(e.currentTarget.value);
              }
              if (e.key === 'Escape') {
                setEditingDescriptions(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(variable.id);
                  return newSet;
                });
                setTempValues(prev => {
                  const newMap = new Map(prev);
                  newMap.delete(variable.id);
                  return newMap;
                });
              }
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            disabled={isSaving}
            onClick={() => {
              const input = document.querySelector(`input[defaultValue="${userDescription}"]`) as HTMLInputElement;
              handleSave(input?.value || tempValue);
            }}
          >
            <Save className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => {
              setEditingDescriptions(prev => {
                const newSet = new Set(prev);
                newSet.delete(variable.id);
                return newSet;
              });
              setTempValues(prev => {
                const newMap = new Map(prev);
                newMap.delete(variable.id);
                return newMap;
              });
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 group">
        <span className="text-xs text-muted-foreground truncate flex-1">
          {userDescription || "Add description..."}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
          onClick={() => {
            setTempValues(prev => new Map(prev).set(variable.id, userDescription));
            setEditingDescriptions(prev => new Set(prev).add(variable.id));
          }}
        >
          <Edit2 className="h-3 w-3" />
        </Button>
      </div>
    );
  };

  const selectedCount = selectedVariables.size;
  const totalVariables = transformedVariables.length;

  return (
    <div className="space-y-6" data-testid="enhanced-variables-table">

      {/* Search and Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`${t("search")} ${t("variables").toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-variables"
          />
        </div>
        
        <Button
          variant={showSelectedOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setShowSelectedOnly(!showSelectedOnly)}
          className="gap-2"
          data-testid="button-toggle-selected"
        >
          {showSelectedOnly ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {showSelectedOnly ? t("showAll") : t("showSelected")}
        </Button>
      </div>

      {/* Table Section */}
      <div className="border rounded-lg bg-background">
        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader>
              <TableRow className="border-b">
                <TableHead className="w-12 text-center px-3"></TableHead>
                <TableHead className="text-left min-w-[200px] px-4">{t("nodeName")}</TableHead>
                <TableHead className="text-left min-w-[120px] px-4">{t("description")}</TableHead>
                <TableHead className="text-center min-w-[140px] px-4">{t("value")}</TableHead>
                <TableHead className="text-center min-w-[120px] px-4">{t("timestamp")}</TableHead>
                <TableHead className="text-left min-w-[120px] px-3">{t("address")}</TableHead>
                <TableHead className="text-center min-w-[80px] px-3">Data Type</TableHead>
                <TableHead className="text-left min-w-[180px] px-4">{t("userDescription")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-testid="table-variables-body">
              {filteredParentVariables.map((variable) => {
                const childVariables = getChildVariables(transformedVariables, variable.id);
                const isSelected = selectedVariables.has(variable.id);
                const hasChildren = variable.type === "channel" && childVariables.length > 0;
                const statusBgColor = getStatusBackgroundColor("active");
                const isBitRow = variable.isBitRow;

                return (
                  <React.Fragment key={variable.id}>
                    <TableRow className={`group hover:bg-muted/50 ${isBitRow ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}>
                      <TableCell className="text-center px-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            hasChildren
                              ? handleChannelSelect(variable.id, checked as boolean)
                              : handleVariableSelect(variable.id, checked as boolean)
                          }
                          data-testid={`checkbox-variable-${variable.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium px-4">
                        <div className="flex items-center gap-2">
                          {isBitRow && (
                            <Badge variant="outline" className="text-xs">
                              Bit {(variable.bitPosition?.toString() || '0').padStart(2, '0')}
                            </Badge>
                          )}
                          <span className="truncate">{variable.opcua_reg_add}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground px-4">
                        <div className="truncate max-w-[100px]" title={variable.description}>
                          {variable.description}
                        </div>
                      </TableCell>
                      <TableCell className={`font-mono font-medium text-center px-4 ${statusBgColor}`}>
                        <span className="inline-block px-2 py-1 rounded text-sm">
                          {getVariableValue(variable)}
                        </span>
                      </TableCell>
                      <TableCell className={`font-mono text-xs text-muted-foreground text-center px-4 ${statusBgColor}`}>
                        {getTimestamp()}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground px-4">
                        <div className="truncate" title={variable.plc_reg_add}>
                          {variable.plc_reg_add}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground text-center px-4">
                        <Badge variant="secondary" className="text-xs">
                          {variable.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4">
                        <div className="border rounded px-2 py-1 bg-muted/20 min-h-[28px] flex items-center">
                          {renderUserDescriptionCell(variable)}
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Render existing child variables if any */}
                    {hasChildren &&
                      childVariables.map((childVariable) => {
                        const isChildSelected = selectedVariables.has(childVariable.id);

                        return (
                          <TableRow
                            key={childVariable.id}
                            className="bg-muted/20 border-l-4 border-l-primary/30 hover:bg-muted/40"
                          >
                            <TableCell className="text-center px-3">
                              <Checkbox
                                checked={isChildSelected}
                                onCheckedChange={(checked) =>
                                  handleVariableSelect(childVariable.id, checked as boolean)
                                }
                                data-testid={`checkbox-child-${childVariable.id}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium text-sm px-4 pl-8">
                              <div className="truncate">{childVariable.opcua_reg_add}</div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground px-4">
                              <div className="truncate max-w-[100px]" title={childVariable.description}>
                                {childVariable.description}
                              </div>
                            </TableCell>
                            <TableCell className={`font-mono font-medium text-center px-4 ${statusBgColor}`}>
                              <span className="inline-block px-2 py-1 rounded text-sm">
                                {getVariableValue(childVariable)}
                              </span>
                            </TableCell>
                            <TableCell className={`font-mono text-xs text-muted-foreground text-center px-4 ${statusBgColor}`}>
                              {getTimestamp()}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground px-4">
                              <div className="truncate" title={childVariable.plc_reg_add}>
                                {childVariable.plc_reg_add}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground text-center px-4">
                              <Badge variant="secondary" className="text-xs">
                                {childVariable.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-4">
                              <div className="border rounded px-2 py-1 bg-muted/20 min-h-[28px] flex items-center">
                                {renderUserDescriptionCell(childVariable)}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </React.Fragment>
                );
              })}
              
              {filteredParentVariables.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {searchTerm ? t("noMatchingVariables") : t("noData")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );
}