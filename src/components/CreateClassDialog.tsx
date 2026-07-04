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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
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
  const [pickedColumn, setPickedColumn] = useState<string>("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setName("");
    setPasted("");
    setParsedRows([]);
    setColumns([]);
    setPickedColumn("");
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
          setPickedColumn(cols[0]);
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
          setPickedColumn(cols[0]);
        } catch (err) {
          toast.error("Could not read file");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Please upload a CSV or Excel (.xlsx) file");
    }
  }

  function namesFromImport(): string[] {
    if (!pickedColumn) return [];
    return parsedRows.map((r) => String(r[pickedColumn] ?? "").trim()).filter(Boolean);
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New class</DialogTitle>
          <DialogDescription>Name your class and add your student roster.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="cname">Class name</Label>
          <Input
            id="cname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Biology 9A"
          />
        </div>

        <Tabs defaultValue="paste" className="mt-2">
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
                {loading ? "Creating…" : `Create class (${namesFromPaste().length})`}
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
                  <Label>Which column has the names?</Label>
                  <Select value={pickedColumn} onValueChange={setPickedColumn}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-md border border-border bg-card p-3 text-xs">
                  <div className="mb-1 font-medium text-muted-foreground">
                    Preview — {namesFromImport().length} students
                  </div>
                  <div className="max-h-32 overflow-auto text-foreground">
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
      </DialogContent>
    </Dialog>
  );
}
