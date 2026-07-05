import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Upload } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: (classId: string) => void;
}

function randomToken() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function CreateClassDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("");
  const [pasted, setPasted] = useState("");
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedCells, setSelectedCells] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ row: number; column: string } | null>(null);
  const [selectionCurrent, setSelectionCurrent] = useState<{ row: number; column: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setName("");
    setPasted("");
    setParsedRows([]);
    setColumns([]);
    setSelectedCells([]);
    setDragging(false);
    setSelectionStart(null);
    setSelectionCurrent(null);
  }

  function handleFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          const rows = res.data as Record<string, string>[];
          if (!rows.length) return toast.error("File is empty");
          const cols = Object.keys(rows[0]);
          setParsedRows(rows);
          setColumns(cols);
          setSelectedCells([]);
        },
        error: (err) => toast.error("Parse error: " + err.message),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
          if (!rows.length) return toast.error("Sheet is empty");
          const cols = Object.keys(rows[0]);
          setParsedRows(rows);
          setColumns(cols);
          setSelectedCells([]);
        } catch (err) {
          toast.error("Could not read file");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Please upload a CSV or Excel (.xlsx) file");
    }
  }

  function toggleCell(rowIndex: number, column: string) {
    const key = `${rowIndex}:${column}`;
    setSelectedCells((prev) =>
      prev.includes(key) ? prev.filter((cell) => cell !== key) : [...prev, key],
    );
  }

  function handleCellClick(rowIndex: number, column: string, ctrlKey: boolean, shiftKey: boolean) {
    if (shiftKey && selectedCells.length > 0) {
      // Shift+Click: extend selection to range
      const lastKey = selectedCells[selectedCells.length - 1];
      const [lastRow, lastCol] = lastKey.split(":");
      selectRange(
        { row: parseInt(lastRow), column: lastCol },
        { row: rowIndex, column }
      );
    } else if (ctrlKey) {
      // Ctrl+Click: toggle individual cell
      toggleCell(rowIndex, column);
    } else {
      // Regular click: select only this cell
      setSelectedCells([`${rowIndex}:${column}`]);
    }
  }

  function selectColumn(column: string) {
    const columnCells: string[] = [];
    for (let rowIndex = 0; rowIndex < parsedRows.length; rowIndex++) {
      const value = String(parsedRows[rowIndex]?.[column] ?? "").trim();
      if (value) {
        columnCells.push(`${rowIndex}:${column}`);
      }
    }
    setSelectedCells(columnCells);
  }

  function selectRange(start: { row: number; column: string }, end: { row: number; column: string }) {
    const startRow = Math.min(start.row, end.row);
    const endRow = Math.max(start.row, end.row);
    const startColIndex = columns.indexOf(start.column);
    const endColIndex = columns.indexOf(end.column);
    const minCol = Math.min(startColIndex, endColIndex);
    const maxCol = Math.max(startColIndex, endColIndex);

    const nextSelection: string[] = [];
    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
      for (let colIndex = minCol; colIndex <= maxCol; colIndex += 1) {
        const column = columns[colIndex];
        if (column) nextSelection.push(`${rowIndex}:${column}`);
      }
    }
    setSelectedCells(nextSelection);
  }

  function handleCellMouseDown(rowIndex: number, column: string) {
    setDragging(true);
    setSelectionStart({ row: rowIndex, column });
    setSelectionCurrent({ row: rowIndex, column });
  }

  function handleCellMouseEnter(rowIndex: number, column: string) {
    if (!dragging) return;
    setSelectionCurrent({ row: rowIndex, column });
  }

  function handleTableMouseUp() {
    if (!dragging || !selectionStart || !selectionCurrent) {
      setDragging(false);
      setSelectionStart(null);
      setSelectionCurrent(null);
      return;
    }

    selectRange(selectionStart, selectionCurrent);
    setDragging(false);
    setSelectionStart(null);
    setSelectionCurrent(null);
  }

  function namesFromImport(): string[] {
    return selectedCells
      .map((key) => {
        const [rowIndex, column] = key.split(":");
        const row = parsedRows[Number(rowIndex)];
        return String(row?.[column] ?? "").trim();
      })
      .filter(Boolean);
  }

  function namesFromPaste(): string[] {
    return pasted
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function create(names: string[]) {
    if (!name.trim()) return toast.error("Give the class a name");
    if (names.length < 2) return toast.error("Need at least 2 students");
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const { data: cls, error: clsErr } = await supabase
        .from("classes")
        .insert({ name: name.trim(), owner_id: userData.user.id })
        .select("id")
        .single();
      if (clsErr || !cls) throw clsErr ?? new Error("Failed");

      const studentRows = names.map((n, i) => ({ class_id: cls.id, name: n, sort_order: i }));
      const { error: stErr } = await supabase.from("students").insert(studentRows);
      if (stErr) throw stErr;

      await supabase.from("share_links").insert({ class_id: cls.id, token: randomToken() });

      toast.success(`Created "${name}" with ${names.length} students`);
      onCreated?.(cls.id);
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="h-[95vh] max-h-[95vh] w-[95vw] max-w-[95vw] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>New class</DialogTitle>
          <DialogDescription>Name your class and add your students.</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1">
          <div className="space-y-2 px-6">
            <Label htmlFor="cname">Class name</Label>
            <Input
              id="cname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Biology 9A"
            />
          </div>

          <Tabs defaultValue="paste" className="mt-2 px-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paste">Type / paste</TabsTrigger>
            <TabsTrigger value="import">Import file</TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-3 pt-2">
            <Label htmlFor="roster">One name per line</Label>
            <Textarea
              id="roster"
              rows={8}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={"Alice\nBilal\nChen\nDamia"}
            />
            <DialogFooter>
              <Button disabled={loading} onClick={() => create(namesFromPaste())}>
                {loading ? "Creating…" : `Create class with ${namesFromPaste().length} students`}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="import" className="space-y-3 pt-2">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-8 text-center hover:bg-muted/50">
              <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Click to upload CSV or Excel</span>
              <span className="mt-1 text-xs text-muted-foreground">.csv, .xlsx</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>

            {columns.length > 0 && (
              <>
                <div className="space-y-1.5">
                  <Label>Select the cells containing student names</Label>
                  <p className="text-xs text-muted-foreground">
                    Click to select one cell. Drag to select a range. Shift+Click to extend selection. Ctrl+Click to toggle individual cells.
                  </p>
                  <div className="rounded-md border border-border bg-card p-2">
                    <table className="min-w-full border-collapse text-left text-xs select-none" onMouseUp={handleTableMouseUp} onMouseLeave={() => { if (dragging) { setDragging(false); } }}>
                      <thead>
                        <tr>
                          {columns.map((column) => (
                            <th 
                              key={column} 
                              onClick={() => selectColumn(column)}
                              className="border border-border bg-muted/50 px-2 py-1 font-medium text-muted-foreground cursor-pointer hover:bg-muted transition-colors"
                              title="Click to select all values in this column"
                            >
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.slice(0, 80).map((row, rowIndex) => (
                          <tr key={`${rowIndex}`}>
                            {columns.map((column) => {
                              const value = String(row[column] ?? "").trim();
                              const key = `${rowIndex}:${column}`;
                              const selected = selectedCells.includes(key);
                              const isInDragRange = dragging && selectionStart && selectionCurrent
                                ? (rowIndex >= Math.min(selectionStart.row, selectionCurrent.row) && 
                                   rowIndex <= Math.max(selectionStart.row, selectionCurrent.row) &&
                                   columns.indexOf(column) >= Math.min(columns.indexOf(selectionStart.column), columns.indexOf(selectionCurrent.column)) &&
                                   columns.indexOf(column) <= Math.max(columns.indexOf(selectionStart.column), columns.indexOf(selectionCurrent.column)))
                                : false;
                              return (
                                <td key={column} className="border border-border p-1">
                                  <button
                                    type="button"
                                    className={`block w-full rounded px-2 py-1 text-left cursor-cell transition-colors ${
                                      selected || isInDragRange
                                        ? "bg-primary text-primary-foreground"
                                        : value
                                          ? "bg-background hover:bg-muted"
                                          : "bg-muted/40 text-muted-foreground"
                                    }`}
                                    onMouseDown={() => value && handleCellMouseDown(rowIndex, column)}
                                    onMouseEnter={() => value && handleCellMouseEnter(rowIndex, column)}
                                    onClick={(e) => value && handleCellClick(rowIndex, column, e.ctrlKey || e.metaKey, e.shiftKey)}
                                    disabled={!value}
                                  >
                                    {value || "—"}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="rounded-md border border-border bg-card p-3 text-xs">
                  <div className="mb-1 font-medium text-muted-foreground">
                    Selected — {namesFromImport().length} students
                  </div>
                  <div className="max-h-24 overflow-auto text-foreground">
                    {namesFromImport().slice(0, 30).join(", ")}
                    {namesFromImport().length > 30 ? "…" : ""}
                  </div>
                </div>
              </>
            )}

            <DialogFooter>
              <Button
                disabled={loading || namesFromImport().length === 0}
                onClick={() => create(namesFromImport())}
              >
                {loading ? "Creating…" : `Create class (${namesFromImport().length})`}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
        </div>

        <div className="border-t px-6 py-4">
          {/* Footer buttons moved here - but only shown in import tab */}
        </div>
      </DialogContent>
    </Dialog>
  );
}
