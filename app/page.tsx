"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  BarChart3,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Database,
  Download,
  Camera,
  FolderOpen,
  ImagePlus,
  Grid2X2,
  Grid3X3,
  LayoutDashboard,
  List,
  LogOut,
  PackagePlus,
  Printer,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  TrendingUp,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

type HatStatus = "AVAILABLE" | "SOLD";
type ViewKey = "dashboard" | "add" | "stock" | "reports";
type StockView = "list" | "grid2" | "grid4";

type Hat = {
  id: string;
  code: string;
  name: string;
  costPrice: number;
  status: HatStatus;
  soldPrice: number | null;
  platform: string;
  boughtAt: string;
  soldAt: string | null;
  image: string | null;
};

type DbHat = {
  id: string;
  code: string;
  name: string;
  cost_price: number;
  status: HatStatus;
  sold_price: number | null;
  platform: string | null;
  bought_at: string;
  sold_at: string | null;
  image_url: string | null;
};

type FormState = {
  name: string;
  costPrice: string;
  image: string;
};

type BulkItem = {
  name: string;
  costPrice: number;
};

type LoginMode = "login" | "register";
type ChartPoint = {
  label: string;
  value: number;
  helper: string;
};

const storeName = "Archana Caps";
const logoSrc = "/archana-caps-logo.png";

const defaultImage =
  "https://images.unsplash.com/photo-1521369909029-2afed882baee?q=80&w=800&auto=format&fit=crop";

const initialHats: Hat[] = [
  {
    id: "demo-1",
    code: "HT0001",
    name: "Nike Vintage Navy Cap",
    costPrice: 45000,
    status: "AVAILABLE",
    soldPrice: null,
    platform: "",
    boughtAt: "2026-05-01",
    soldAt: null,
    image: defaultImage,
  },
  {
    id: "demo-2",
    code: "HT0002",
    name: "New Era Black Snapback",
    costPrice: 60000,
    status: "AVAILABLE",
    soldPrice: null,
    platform: "",
    boughtAt: "2026-05-02",
    soldAt: null,
    image: "https://images.unsplash.com/photo-1572307480813-ceb0e59d8325?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "demo-3",
    code: "HT0003",
    name: "Adidas Red Sport Cap",
    costPrice: 35000,
    status: "SOLD",
    soldPrice: 95000,
    platform: "Shopee",
    boughtAt: "2026-05-02",
    soldAt: "2026-05-05",
    image: "https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?q=80&w=800&auto=format&fit=crop",
  },
];

const emptyForm: FormState = {
  name: "",
  costPrice: "",
  image: "",
};

function subscribeToClientReady(onStoreChange: () => void) {
  const timeoutId = window.setTimeout(onStoreChange, 0);
  return () => window.clearTimeout(timeoutId);
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

function mapDbHat(row: DbHat): Hat {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    costPrice: row.cost_price,
    status: row.status,
    soldPrice: row.sold_price,
    platform: row.platform || "",
    boughtAt: row.bought_at,
    soldAt: row.sold_at,
    image: row.image_url,
  };
}

function makeLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseBulkItems(value: string): BulkItem[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*?)[,;\t|-]\s*([0-9][0-9.]*)$/);
      if (!match) return null;

      const name = match[1].trim();
      const costPrice = Number(match[2].replace(/[^0-9]/g, ""));
      if (!name || !costPrice) return null;

      return { name, costPrice };
    })
    .filter((item): item is BulkItem => Boolean(item));
}

function formatRupiah(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function resizeImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new window.Image();

      image.onload = () => {
        const maxSize = 900;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Browser tidak bisa memproses gambar."));
          return;
        }

        canvas.width = width;
        canvas.height = height;
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };

      image.onerror = () => reject(new Error("File gambar tidak bisa dibaca."));
      image.src = String(reader.result);
    };

    reader.onerror = () => reject(new Error("File gambar tidak bisa dibaca."));
    reader.readAsDataURL(file);
  });
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

function Button({ children, className = "", variant = "primary", ...props }: ButtonProps) {
  const styles = {
    primary: "bg-slate-950 text-white hover:bg-slate-800",
    secondary: "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
    ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-950",
  }[variant];

  return (
    <button
      type="button"
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm font-medium transition ${
        active ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon className="shrink-0" size={18} />
        <span className="truncate">{label}</span>
      </span>
      {active && <ChevronRight className="shrink-0" size={16} />}
    </button>
  );
}

function MetricCard({ icon: Icon, label, value, helper }: { icon: LucideIcon; label: string; value: string; helper: string }) {
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{helper}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
          <Icon size={20} />
        </div>
      </div>
    </Panel>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Icon size={19} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      {action && <div className="w-full md:w-auto">{action}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: HatStatus }) {
  const isSold = status === "SOLD";

  return (
    <span
      className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-bold ${
        isSold ? "bg-slate-950 text-white" : "bg-emerald-50 text-emerald-700"
      }`}
    >
      {isSold ? "Sold" : "Available"}
    </span>
  );
}

function StockViewButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-9 items-center justify-center rounded-md px-3 transition ${
        active ? "bg-slate-950 text-white shadow-sm" : "text-slate-500 hover:bg-white hover:text-slate-950"
      }`}
    >
      <Icon size={17} />
    </button>
  );
}

function SalesBarChart({ data }: { data: ChartPoint[] }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <Panel className="p-4 sm:p-5">
      <SectionHeader icon={BarChart3} title="Grafik Penjualan" description="Omzet per tanggal dari item yang sudah SOLD." />
      <div className="grid gap-3">
        {data.map((item) => (
          <div key={item.label} className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-bold text-slate-700">{item.label}</span>
              <span className="shrink-0 font-black text-slate-950">{formatRupiah(item.value)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-red-600" style={{ width: `${Math.max(8, (item.value / maxValue) * 100)}%` }} />
            </div>
            <p className="text-xs font-medium text-slate-400">{item.helper}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PlatformBreakdown({ data }: { data: ChartPoint[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Panel className="p-4 sm:p-5">
      <SectionHeader icon={CircleDollarSign} title="Channel Penjualan" description="Distribusi omzet berdasarkan platform." />
      <div className="grid gap-3">
        {data.map((item) => {
          const percentage = total ? Math.round((item.value / total) * 100) : 0;

          return (
            <div key={item.label} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-slate-700">{item.label}</span>
                <span className="text-sm font-black text-red-600">{percentage}%</span>
              </div>
              <p className="mt-2 text-xl font-black text-slate-950">{formatRupiah(item.value)}</p>
              <p className="mt-1 text-xs font-medium text-slate-400">{item.helper}</p>
            </div>
          );
        })}

        {!data.length && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm font-medium text-slate-500">Belum ada penjualan.</div>}
      </div>
    </Panel>
  );
}

function LoginScreen({
  email,
  password,
  mode,
  loading,
  message,
  onEmailChange,
  onPasswordChange,
  onModeChange,
  onSubmit,
}: {
  email: string;
  password: string;
  mode: LoginMode;
  loading: boolean;
  message: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onModeChange: (mode: LoginMode) => void;
  onSubmit: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f1ed] p-3 sm:p-5">
      <section className="grid w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl md:grid-cols-[minmax(0,1.08fr)_440px]">
        <div className="relative overflow-hidden bg-slate-950 p-6 text-white sm:p-8 md:p-10">
          <div className="absolute inset-x-0 bottom-0 h-40 bg-red-700/30" />
          <div className="relative z-10 flex min-h-[420px] flex-col justify-between gap-8 md:min-h-[520px] md:gap-10">
            <div>
              <Image src={logoSrc} alt={storeName} width={180} height={180} className="h-28 w-28 rounded-2xl object-cover ring-1 ring-white/10 sm:h-36 sm:w-36" priority />
              <p className="mt-8 text-sm font-black uppercase text-red-300">{storeName}</p>
              <h1 className="mt-3 max-w-xl text-3xl font-black leading-tight text-white sm:text-4xl md:text-5xl md:leading-none">
                Inventory cockpit untuk stok dan penjualan topi.
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-6 text-slate-300">
                Kelola topi masuk, stok available, item sold, nota, dan laporan omzet dalam satu dashboard yang siap dipakai harian.
              </p>
            </div>

            <div className="grid gap-3 min-[430px]:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/10 p-4">
                <p className="text-2xl font-black">Live</p>
                <p className="mt-1 text-xs font-semibold text-slate-300">Stok tersimpan per akun</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/10 p-4">
                <p className="text-2xl font-black">PDF</p>
                <p className="mt-1 text-xs font-semibold text-slate-300">Nota siap cetak</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/10 p-4">
                <p className="text-2xl font-black">Report</p>
                <p className="mt-1 text-xs font-semibold text-slate-300">Omzet dan profit</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid content-center p-4 sm:p-7 md:p-8">
          <div className="mb-7">
            <p className="text-sm font-bold text-red-600">{mode === "login" ? "Welcome back" : "Create workspace"}</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">{mode === "login" ? "Masuk ke dashboard" : "Daftar akun baru"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Gunakan email yang terdaftar untuk mengakses data toko kamu.</p>
          </div>

          <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <Database className={isSupabaseConfigured ? "mt-0.5 text-emerald-600" : "mt-0.5 text-amber-600"} size={18} />
              <div>
                <p className="text-sm font-black text-slate-950">{isSupabaseConfigured ? "Database connected" : "Demo mode"}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {isSupabaseConfigured ? "Data inventory tersinkron ke Supabase Auth dan tabel hats." : "Mode lokal aktif sampai konfigurasi Supabase tersedia."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => onModeChange("login")}
              className={`h-10 flex-1 rounded-md text-sm font-bold transition ${mode === "login" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => onModeChange("register")}
              className={`h-10 flex-1 rounded-md text-sm font-bold transition ${mode === "register" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
            >
              Register
            </button>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Email
              <input
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                placeholder="admin@archanacaps.test"
                type="email"
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Password
              <input
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="minimal 6 karakter"
                type="password"
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </label>

            {message && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{message}</p>}

            <Button onClick={onSubmit} disabled={loading || !email || !password} className="w-full">
              <User size={17} />
              {loading ? "Memproses..." : mode === "login" ? "Masuk" : "Buat Akun"}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function ThriftHatInventoryApp() {
  const mounted = useSyncExternalStore(subscribeToClientReady, getClientSnapshot, getServerSnapshot);
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [stockView, setStockView] = useState<StockView>("list");
  const [hats, setHats] = useState<Hat[]>(initialHats);
  const [query, setQuery] = useState("");
  const [soldModal, setSoldModal] = useState<Hat | null>(null);
  const [soldPrice, setSoldPrice] = useState("");
  const [platform, setPlatform] = useState("Shopee");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [bulkText, setBulkText] = useState("");
  const [email, setEmail] = useState("admin@archanacaps.test");
  const [password, setPassword] = useState("password123");
  const [loginMode, setLoginMode] = useState<LoginMode>("login");
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [dbMessage, setDbMessage] = useState(isSupabaseConfigured ? "Menunggu login Supabase." : "Mode demo lokal.");
  const [savingAction, setSavingAction] = useState<"single" | "bulk" | "sold" | "sold-print" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const supabase = useMemo(() => getSupabaseClient(), []);

  const stats = useMemo(() => {
    const available = hats.filter((hat) => hat.status === "AVAILABLE");
    const sold = hats.filter((hat) => hat.status === "SOLD");
    const revenue = sold.reduce((sum, hat) => sum + (hat.soldPrice || 0), 0);
    const costSold = sold.reduce((sum, hat) => sum + hat.costPrice, 0);
    const profit = revenue - costSold;
    const stockValue = available.reduce((sum, hat) => sum + hat.costPrice, 0);

    return { available: available.length, sold: sold.length, revenue, profit, stockValue };
  }, [hats]);

  const availableHats = hats
    .filter((hat) => hat.status === "AVAILABLE")
    .filter((hat) => `${hat.code} ${hat.name}`.toLowerCase().includes(query.toLowerCase()));

  const soldHats = hats.filter((hat) => hat.status === "SOLD");
  const bulkItems = useMemo(() => parseBulkItems(bulkText), [bulkText]);
  const salesChart = useMemo(() => {
    const salesByDate = new Map<string, { revenue: number; count: number }>();

    soldHats.forEach((hat) => {
      const date = hat.soldAt || "Tanpa tanggal";
      const current = salesByDate.get(date) || { revenue: 0, count: 0 };
      salesByDate.set(date, {
        revenue: current.revenue + (hat.soldPrice || 0),
        count: current.count + 1,
      });
    });

    const points = Array.from(salesByDate.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .slice(-7)
      .map(([date, value]) => ({
        label: date,
        value: value.revenue,
        helper: `${value.count} item terjual`,
      }));

    return points.length ? points : [{ label: "Belum ada SOLD", value: 0, helper: "Tandai item SOLD untuk mulai melihat grafik." }];
  }, [soldHats]);
  const platformChart = useMemo(() => {
    const salesByPlatform = new Map<string, { revenue: number; count: number }>();

    soldHats.forEach((hat) => {
      const key = hat.platform || "Lainnya";
      const current = salesByPlatform.get(key) || { revenue: 0, count: 0 };
      salesByPlatform.set(key, {
        revenue: current.revenue + (hat.soldPrice || 0),
        count: current.count + 1,
      });
    });

    return Array.from(salesByPlatform.entries())
      .sort(([, valueA], [, valueB]) => valueB.revenue - valueA.revenue)
      .map(([platformName, value]) => ({
        label: platformName,
        value: value.revenue,
        helper: `${value.count} transaksi`,
      }));
  }, [soldHats]);
  const stockGridClass =
    stockView === "list"
      ? "grid gap-3"
      : stockView === "grid2"
        ? "grid grid-cols-2 gap-3"
        : "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4";

  const loadHats = useCallback(async () => {
    if (!supabase) return;
    setDataLoading(true);

    const { data, error } = await supabase.from("hats").select("*").order("created_at", { ascending: false });

    if (error) {
      setDbMessage(`Database error: ${error.message}`);
    } else {
      setHats((data || []).map((row) => mapDbHat(row as DbHat)));
      setDbMessage("Tersambung ke Supabase.");
    }

    setDataLoading(false);
  }, [supabase]);

  async function handleAuth() {
    setMessage("");
    setLoading(true);

    if (!supabase) {
      window.localStorage.setItem("archana-caps-demo-user", email);
      setCurrentUser(email);
      setDbMessage("Mode demo lokal. Data belum tersimpan ke database.");
      setLoading(false);
      return;
    }

    const result =
      loginMode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) {
      setMessage(result.error.message);
    } else {
      setCurrentUser(result.data.user?.email || email);
      setDbMessage(loginMode === "register" ? "Akun dibuat. Cek email jika konfirmasi aktif di Supabase." : "Login Supabase berhasil.");
    }

    setLoading(false);
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    window.localStorage.removeItem("archana-caps-demo-user");
    setCurrentUser(null);
    setHats(initialHats);
    setActiveView("dashboard");
  }

  useEffect(() => {
    if (!supabase) {
      const demoUser = window.localStorage.getItem("archana-caps-demo-user");
      if (demoUser) queueMicrotask(() => setCurrentUser(demoUser));
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setCurrentUser(data.session?.user.email || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user.email || null);
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!currentUser || !supabase) return;
    queueMicrotask(() => void loadHats());
  }, [currentUser, loadHats, supabase]);

  useEffect(() => {
    const video = liveVideoRef.current;
    const stream = cameraStreamRef.current;

    if (!cameraOpen || !video || !stream) return;

    video.srcObject = stream;
    const handleReady = () => setCameraReady(true);
    video.addEventListener("loadedmetadata", handleReady);
    video.addEventListener("canplay", handleReady);
    video.play().catch((error) => {
      const message = error instanceof Error ? error.message : "Preview kamera gagal diputar.";
      setCameraError(`Preview kamera gagal diputar: ${message}`);
    });

    return () => {
      video.removeEventListener("loadedmetadata", handleReady);
      video.removeEventListener("canplay", handleReady);
      video.srcObject = null;
    };
  }, [cameraOpen]);

  useEffect(() => {
    return () => stopRealtimeCamera();
  }, []);

  function updateForm(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleImageFile(file: File | undefined) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setDbMessage("File harus berupa gambar.");
      return;
    }

    try {
      const image = await resizeImageFile(file);
      updateForm("image", image);
      setDbMessage("Foto siap disimpan bersama item.");
    } catch (error) {
      setDbMessage(error instanceof Error ? error.message : "Gagal memproses foto.");
    }
  }

  function clearFormImage() {
    updateForm("image", "");

    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  function stopRealtimeCamera() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraReady(false);
  }

  function closeRealtimeCamera() {
    stopRealtimeCamera();
    setCameraOpen(false);
    setCameraError("");
  }

  async function openRealtimeCamera() {
    setCameraError("");
    setCameraReady(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Browser belum mendukung kamera realtime. Pakai opsi kamera file sebagai fallback.");
      cameraInputRef.current?.click();
      return;
    }

    if (!window.isSecureContext) {
      setCameraError("Kamera realtime butuh HTTPS atau localhost. Jika dibuka dari IP http://172.24.0.1, browser biasanya memblokir kamera.");
      cameraInputRef.current?.click();
      return;
    }

    try {
      stopRealtimeCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });

      cameraStreamRef.current = stream;
      setCameraOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kamera tidak bisa dibuka.";
      setCameraError(`Kamera tidak bisa dibuka: ${message}`);
      cameraInputRef.current?.click();
    }
  }

  function captureRealtimePhoto() {
    const video = liveVideoRef.current;

    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError("Preview kamera belum siap. Coba tunggu sebentar lalu ambil foto lagi.");
      return;
    }

    const canvas = document.createElement("canvas");
    const maxSize = 900;
    const scale = Math.min(1, maxSize / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Browser tidak bisa mengambil foto dari kamera.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    updateForm("image", canvas.toDataURL("image/jpeg", 0.82));
    setDbMessage("Foto realtime siap disimpan bersama item.");
    closeRealtimeCamera();
  }

  function makeHat(item: BulkItem, index: number, image: string | null = null): Hat {
    return {
      id: makeLocalId(),
      code: `HT${String(hats.length + index + 1).padStart(4, "0")}`,
      name: item.name,
      costPrice: item.costPrice,
      status: "AVAILABLE",
      soldPrice: null,
      platform: "",
      boughtAt: new Date().toISOString().slice(0, 10),
      soldAt: null,
      image,
    };
  }

  async function addHats(items: BulkItem[], image: string | null = null) {
    if (!items.length) return false;
    const newHats = items.map((item, index) => makeHat(item, index, image));

    if (supabase) {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setDbMessage("Login Supabase dulu sebelum menyimpan item.");
        return false;
      }

      const rows = newHats.map((hat) => ({
        user_id: userData.user.id,
        code: hat.code,
        name: hat.name,
        cost_price: hat.costPrice,
        status: hat.status,
        sold_price: hat.soldPrice,
        platform: hat.platform,
        bought_at: hat.boughtAt,
        sold_at: hat.soldAt,
        image_url: hat.image,
      }));

      const { data, error } = await supabase.from("hats").insert(rows).select("*");

      if (error) {
        setDbMessage(`Gagal simpan: ${error.message}`);
        return false;
      }

      setHats((current) => [...(data || []).map((row) => mapDbHat(row as DbHat)), ...current]);
      setDbMessage(`${newHats.length} item tersimpan ke Supabase.`);
    } else {
      setHats((current) => [...newHats, ...current]);
    }

    return true;
  }

  async function addHat() {
    if (!form.name.trim() || !form.costPrice) return;

    setSavingAction("single");
    const saved = await addHats(
      [
        {
          name: form.name.trim(),
          costPrice: Number(form.costPrice),
        },
      ],
      form.image.trim() || null
    );
    setSavingAction(null);
    if (!saved) return;

    setForm(emptyForm);
    setActiveView("stock");
  }

  async function addBulkHats() {
    if (!bulkItems.length) return;

    setSavingAction("bulk");
    const saved = await addHats(bulkItems);
    setSavingAction(null);
    if (!saved) return;

    setBulkText("");
    setActiveView("stock");
  }

  function printReceipt(hat: Hat) {
    if (!hat.soldPrice || !hat.soldAt) {
      setDbMessage("Nota hanya bisa dicetak untuk item yang sudah SOLD.");
      return;
    }

    const receiptNumber = `INV-${hat.code}-${hat.soldAt.replaceAll("-", "")}`;
    const logoUrl = `${window.location.origin}${logoSrc}`;
    const receiptWindow = window.open("", "_blank", "width=420,height=720");

    if (!receiptWindow) {
      setDbMessage("Popup nota diblokir browser. Izinkan popup untuk mencetak nota.");
      return;
    }

    receiptWindow.document.write(`<!doctype html>
<html>
  <head>
    <title>${escapeHtml(receiptNumber)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page { size: 80mm auto; margin: 8mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #111827;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px;
      }
      .receipt {
        width: 100%;
        max-width: 320px;
        margin: 0 auto;
      }
      .center { text-align: center; }
      .brand {
        font-size: 20px;
        font-weight: 900;
        letter-spacing: 0;
      }
      .logo {
        width: 64px;
        height: 64px;
        border-radius: 12px;
        object-fit: cover;
        margin-bottom: 8px;
      }
      .muted { color: #6b7280; }
      .line {
        border-top: 1px dashed #9ca3af;
        margin: 14px 0;
      }
      .row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin: 8px 0;
      }
      .label { color: #6b7280; }
      .value {
        text-align: right;
        font-weight: 700;
      }
      .item-name {
        margin-top: 8px;
        font-size: 15px;
        font-weight: 800;
      }
      .total {
        font-size: 18px;
        font-weight: 900;
      }
      .note {
        margin-top: 18px;
        text-align: center;
        line-height: 1.5;
      }
      .screen-actions {
        display: flex;
        gap: 8px;
        margin: 18px auto 0;
        max-width: 320px;
      }
      button {
        flex: 1;
        height: 40px;
        border: 0;
        border-radius: 8px;
        background: #020617;
        color: white;
        font-weight: 800;
        cursor: pointer;
      }
      @media print {
        .screen-actions { display: none; }
      }
    </style>
  </head>
  <body>
    <main class="receipt">
      <div class="center">
        <img class="logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(storeName)}" />
        <div class="brand">${escapeHtml(storeName)}</div>
        <div class="muted">Nota penjualan ${storeName}</div>
      </div>

      <div class="line"></div>

      <div class="row">
        <span class="label">No Nota</span>
        <span class="value">${escapeHtml(receiptNumber)}</span>
      </div>
      <div class="row">
        <span class="label">Tanggal</span>
        <span class="value">${escapeHtml(hat.soldAt)}</span>
      </div>
      <div class="row">
        <span class="label">Platform</span>
        <span class="value">${escapeHtml(hat.platform || "-")}</span>
      </div>

      <div class="line"></div>

      <div class="muted">Item</div>
      <div class="item-name">${escapeHtml(hat.name)}</div>
      <div class="row">
        <span class="label">Kode</span>
        <span class="value">${escapeHtml(hat.code)}</span>
      </div>

      <div class="line"></div>

      <div class="row total">
        <span>Total</span>
        <span>${formatRupiah(hat.soldPrice)}</span>
      </div>

      <div class="line"></div>

      <p class="note muted">Terima kasih sudah belanja.<br />Simpan nota ini sebagai bukti transaksi.</p>
    </main>
    <div class="screen-actions">
      <button onclick="window.print()">Cetak / Save PDF</button>
      <button onclick="window.close()">Tutup</button>
    </div>
    <script>
      window.addEventListener("load", () => setTimeout(() => window.print(), 250));
    </script>
  </body>
</html>`);
    receiptWindow.document.close();
  }

  async function markAsSold(shouldPrintReceipt = false) {
    if (!soldModal || !soldPrice) return;
    setSavingAction(shouldPrintReceipt ? "sold-print" : "sold");

    const updates = {
      status: "SOLD" as HatStatus,
      sold_price: Number(soldPrice),
      platform,
      sold_at: new Date().toISOString().slice(0, 10),
    };

    if (supabase) {
      const { error } = await supabase.from("hats").update(updates).eq("id", soldModal.id);
      if (error) {
        setDbMessage(`Gagal update sold: ${error.message}`);
        setSavingAction(null);
        return;
      }
      setDbMessage("Status sold tersimpan ke Supabase.");
    }

    const soldHat: Hat = {
      ...soldModal,
      status: "SOLD",
      soldPrice: updates.sold_price,
      platform: updates.platform,
      soldAt: updates.sold_at,
    };

    setHats((current) => current.map((hat) => (hat.id === soldModal.id ? soldHat : hat)));
    setSoldModal(null);
    setSoldPrice("");
    setPlatform("Shopee");
    setSavingAction(null);

    if (shouldPrintReceipt) {
      printReceipt(soldHat);
    }
  }

  async function deleteHat(hat: Hat) {
    const confirmed = window.confirm(`Hapus ${hat.code} - ${hat.name} dari stok?`);
    if (!confirmed) return;

    setDeletingId(hat.id);

    if (supabase && !hat.id.startsWith("demo-") && !hat.id.startsWith("local-")) {
      const { error } = await supabase.from("hats").delete().eq("id", hat.id);
      if (error) {
        setDbMessage(`Gagal hapus item: ${error.message}`);
        setDeletingId(null);
        return;
      }
    }

    setHats((current) => current.filter((item) => item.id !== hat.id));
    setDbMessage(`${hat.code} dihapus dari stok.`);
    setDeletingId(null);
  }

  function exportCsv() {
    const header = ["code", "name", "costPrice", "status", "soldPrice", "platform", "boughtAt", "soldAt"];
    const rows = hats.map((hat) =>
      [hat.code, hat.name, hat.costPrice, hat.status, hat.soldPrice || "", hat.platform, hat.boughtAt, hat.soldAt || ""]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "archana-caps-export.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!mounted) {
    return <main className="min-h-screen bg-slate-100" />;
  }

  if (!currentUser) {
    return (
      <LoginScreen
        email={email}
        password={password}
        mode={loginMode}
        loading={loading}
        message={message}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onModeChange={setLoginMode}
        onSubmit={handleAuth}
      />
    );
  }

  const navItems: Array<{ key: ViewKey; label: string; icon: LucideIcon }> = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "add", label: "Topi Masuk", icon: PackagePlus },
    { key: "stock", label: "Stok", icon: Boxes },
    { key: "reports", label: "Laporan", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto grid w-full max-w-7xl gap-4 p-3 sm:p-4 md:gap-5 md:p-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <Image src={logoSrc} alt={storeName} width={44} height={44} className="h-11 w-11 rounded-xl object-cover" />
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-slate-950">{storeName}</p>
              <p className="truncate text-xs font-medium text-slate-500">{currentUser}</p>
            </div>
          </div>

          <nav className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
            {navItems.map((item) => (
              <SidebarItem
                key={item.key}
                icon={item.icon}
                label={item.label}
                active={activeView === item.key}
                onClick={() => setActiveView(item.key)}
              />
            ))}
          </nav>

          <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50 p-4 text-cyan-950">
            <div className="flex items-start gap-2">
              <Database className="mt-0.5 shrink-0" size={16} />
              <div>
                <p className="text-sm font-bold">{isSupabaseConfigured ? "Database" : "Demo"}</p>
                <p className="mt-1 text-xs leading-5 text-cyan-800">{dbMessage}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <Button variant="secondary" onClick={loadHats} disabled={!supabase || dataLoading}>
              <RefreshCw size={16} />
              {dataLoading ? "Loading..." : "Refresh"}
            </Button>
            <Button variant="ghost" onClick={logout}>
              <LogOut size={16} />
              Logout
            </Button>
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          {(activeView === "dashboard" || activeView === "reports") && (
            <>
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-2xl bg-slate-950 text-white shadow-sm"
              >
                <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_220px] md:p-7">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-red-300">{storeName} Dashboard</p>
                    <h1 className="mt-2 max-w-2xl text-3xl font-black leading-tight text-white md:text-4xl">
                      Pantau stok, omzet, dan performa penjualan toko.
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                      Ringkasan ini membantu membaca barang available, item sold, omzet, profit, dan channel penjualan.
                    </p>
                  </div>
                  <div className="grid content-end gap-3 rounded-xl bg-white/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Nilai stok</p>
                    <p className="text-2xl font-black">{formatRupiah(stats.stockValue)}</p>
                    <Button variant="secondary" onClick={exportCsv} className="w-full border-white/15 bg-white text-slate-950 hover:bg-slate-100">
                      <Download size={17} />
                      Export CSV
                    </Button>
                  </div>
                </div>
              </motion.section>

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard icon={Boxes} label="Stok Available" value={`${stats.available} pcs`} helper="Siap dijual" />
                <MetricCard icon={CheckCircle2} label="Topi Terjual" value={`${stats.sold} pcs`} helper="Semua periode" />
                <MetricCard icon={Wallet} label="Omzet" value={formatRupiah(stats.revenue)} helper="Dari item sold" />
                <MetricCard icon={TrendingUp} label="Profit Kotor" value={formatRupiah(stats.profit)} helper="Jual dikurangi modal" />
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
                <SalesBarChart data={salesChart} />
                <PlatformBreakdown data={platformChart} />
              </section>
            </>
          )}

          {activeView === "add" && (
            <Panel className="p-4 sm:p-5">
              <SectionHeader icon={ImagePlus} title="Catat Topi Masuk" description="Tambahkan satu item atau paste daftar item secara massal." />

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Nama topi
                  <input value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="Nike vintage navy" className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Harga modal
                  <input value={form.costPrice} onChange={(event) => updateForm("costPrice", event.target.value.replace(/[^0-9]/g, ""))} placeholder="45000" inputMode="numeric" className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700 lg:col-span-2">
                  URL foto opsional
                  <input value={form.image} onChange={(event) => updateForm("image", event.target.value)} placeholder="Kosongkan jika belum ada foto" className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
                </label>
                <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:col-span-2">
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void handleImageFile(event.target.files?.[0])}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => void handleImageFile(event.target.files?.[0])}
                  />

                  <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-center">
                    <Image
                      src={form.image || defaultImage}
                      alt="Preview foto topi"
                      width={240}
                      height={180}
                      className="aspect-[4/3] w-full rounded-lg object-cover sm:w-[120px]"
                      unoptimized={form.image.startsWith("data:")}
                    />
                    <div className="grid gap-3">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Button variant="secondary" onClick={() => galleryInputRef.current?.click()}>
                          <FolderOpen size={16} />
                          Galeri
                        </Button>
                        <Button variant="secondary" onClick={() => galleryInputRef.current?.click()}>
                          <ImagePlus size={16} />
                          File
                        </Button>
                        <Button variant="secondary" onClick={openRealtimeCamera}>
                          <Camera size={16} />
                          Kamera
                        </Button>
                      </div>
                      {cameraError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">{cameraError}</p>}
                      {form.image && (
                        <Button variant="ghost" onClick={clearFormImage} className="h-9 justify-self-start px-3">
                          Hapus foto
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <Button onClick={addHat} disabled={savingAction === "single" || !form.name.trim() || !form.costPrice} className="lg:col-span-2">
                  <PackagePlus size={17} />
                  {savingAction === "single" ? "Menyimpan..." : "Simpan ke Stok"}
                </Button>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-5">
                <SectionHeader icon={PackagePlus} title="Tambah Massal" description="Paste satu item per baris dengan format nama dan modal." />
                <div className="grid gap-4">
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Daftar item
                    <textarea
                      value={bulkText}
                      onChange={(event) => setBulkText(event.target.value)}
                      placeholder={"Nike vintage navy, 45000\nNew Era black snapback, 60000\nAdidas red cap - 35000"}
                      rows={5}
                      className="min-h-32 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                    />
                  </label>
                  <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-slate-600">
                      {bulkItems.length ? `${bulkItems.length} item siap disimpan` : "Belum ada baris valid"}
                    </p>
                    <Button onClick={addBulkHats} disabled={!bulkItems.length || savingAction === "bulk"} className="w-full sm:w-auto">
                      <PackagePlus size={17} />
                      {savingAction === "bulk" ? "Menyimpan..." : "Simpan Massal"}
                    </Button>
                  </div>
                </div>
              </div>
            </Panel>
          )}

          {(activeView === "dashboard" || activeView === "stock") && (
            <Panel className="p-4 sm:p-5">
              <SectionHeader
                icon={Boxes}
                title="Stok Available"
                description="Cari item dan tandai sold saat barang laku."
                action={
                  <div className="grid w-full gap-3 md:w-auto md:min-w-[360px]">
                    <div className="relative w-full">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari kode atau nama..." className="h-11 w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
                    </div>
                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                      <StockViewButton label="Tampilan list" icon={List} active={stockView === "list"} onClick={() => setStockView("list")} />
                      <StockViewButton label="Tampilan 2 grid" icon={Grid2X2} active={stockView === "grid2"} onClick={() => setStockView("grid2")} />
                      <StockViewButton label="Tampilan 4 grid" icon={Grid3X3} active={stockView === "grid4"} onClick={() => setStockView("grid4")} />
                    </div>
                  </div>
                }
              />

              <div className={stockGridClass}>
                {availableHats.map((hat) => (
                  <article
                    key={hat.id}
                    className={
                      stockView === "list"
                        ? "grid gap-4 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[80px_minmax(0,1fr)_auto] sm:items-center"
                        : "grid min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white"
                    }
                  >
                    <Image
                      src={hat.image || defaultImage}
                      alt={hat.name}
                      width={320}
                      height={220}
                      unoptimized={Boolean(hat.image?.startsWith("data:"))}
                      className={
                        stockView === "list"
                          ? "h-36 w-full rounded-lg object-cover sm:h-20 sm:w-20"
                          : stockView === "grid2"
                            ? "aspect-[4/3] h-auto w-full object-cover"
                            : "aspect-square h-auto w-full object-cover"
                      }
                    />
                    <div className={stockView === "list" ? "min-w-0" : "grid min-w-0 gap-3 p-3"}>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className={`${stockView === "list" ? "text-base" : "text-sm"} line-clamp-2 font-bold leading-snug text-slate-950`}>
                            {hat.name}
                          </h3>
                          {stockView === "list" && <StatusBadge status={hat.status} />}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                          <span className="rounded-full bg-slate-100 px-3 py-1">{hat.code}</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1">Modal: {formatRupiah(hat.costPrice)}</span>
                        </div>
                      </div>
                      {stockView !== "list" && <StatusBadge status={hat.status} />}
                    </div>
                    <div className={stockView === "list" ? "grid gap-2 sm:grid-cols-2" : "m-3 mt-0 grid gap-2"}>
                      <Button onClick={() => setSoldModal(hat)} className={stockView === "list" ? "w-full sm:w-auto" : "h-10 w-auto px-3"}>
                        SOLD
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => void deleteHat(hat)}
                        disabled={deletingId === hat.id}
                        className={stockView === "list" ? "w-full sm:w-auto" : "h-10 w-auto px-3"}
                      >
                        <Trash2 size={16} />
                        {deletingId === hat.id ? "Hapus..." : "Hapus"}
                      </Button>
                    </div>
                  </article>
                ))}

                {!availableHats.length && (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm font-medium text-slate-500">
                    Tidak ada stok available.
                  </div>
                )}
              </div>
            </Panel>
          )}

          {(activeView === "dashboard" || activeView === "reports") && (
            <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
              <Panel className="p-4 sm:p-5">
                <SectionHeader
                  icon={BarChart3}
                  title="Laporan Penjualan"
                  description="Data item terjual dan profit per item."
                  action={
                    <Button variant="secondary" onClick={exportCsv} className="w-full sm:w-auto">
                      <Download size={16} />
                      CSV
                    </Button>
                  }
                />

                <div className="grid gap-3 lg:hidden">
                  {soldHats.map((hat) => (
                    <article key={hat.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-400">{hat.code}</p>
                          <h3 className="mt-1 line-clamp-2 font-black leading-snug text-slate-950">{hat.name}</h3>
                          <p className="mt-1 text-xs font-semibold text-slate-400">{hat.platform || "-"} - {hat.soldAt}</p>
                        </div>
                        <Button variant="secondary" onClick={() => printReceipt(hat)} className="h-9 shrink-0 px-3">
                          <Printer size={15} />
                        </Button>
                      </div>
                      <div className="mt-4 grid gap-2 text-xs min-[430px]:grid-cols-3">
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="font-bold text-slate-400">Modal</p>
                          <p className="mt-1 font-black text-slate-700">{formatRupiah(hat.costPrice)}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="font-bold text-slate-400">Jual</p>
                          <p className="mt-1 font-black text-slate-700">{formatRupiah(hat.soldPrice)}</p>
                        </div>
                        <div className="rounded-lg bg-emerald-50 p-3">
                          <p className="font-bold text-emerald-600">Profit</p>
                          <p className="mt-1 font-black text-emerald-700">{formatRupiah((hat.soldPrice || 0) - hat.costPrice)}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                  {!soldHats.length && (
                    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm font-medium text-slate-500">
                      Belum ada item SOLD.
                    </div>
                  )}
                </div>

                <div className="hidden overflow-x-auto rounded-xl border border-slate-200 lg:block">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Kode</th>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3">Modal</th>
                        <th className="px-4 py-3">Jual</th>
                        <th className="px-4 py-3">Profit</th>
                        <th className="px-4 py-3">Nota</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {soldHats.map((hat) => (
                        <tr key={hat.id}>
                          <td className="px-4 py-4 font-semibold text-slate-500">{hat.code}</td>
                          <td className="px-4 py-4">
                            <p className="font-bold text-slate-950">{hat.name}</p>
                            <p className="mt-1 text-xs text-slate-400">{hat.platform || "-"} - {hat.soldAt}</p>
                          </td>
                          <td className="px-4 py-4 font-medium text-slate-600">{formatRupiah(hat.costPrice)}</td>
                          <td className="px-4 py-4 font-medium text-slate-600">{formatRupiah(hat.soldPrice)}</td>
                          <td className="px-4 py-4 font-bold text-emerald-700">{formatRupiah((hat.soldPrice || 0) - hat.costPrice)}</td>
                          <td className="px-4 py-4">
                            <Button variant="secondary" onClick={() => printReceipt(hat)} className="h-9 px-3">
                              <Printer size={15} />
                              Cetak
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {!soldHats.length && (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-sm font-medium text-slate-500">
                            Belum ada item SOLD.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel className="p-4 sm:p-5">
                <SectionHeader icon={CircleDollarSign} title="Ringkasan Bisnis" description="Gambaran cepat performa toko." />
                <div className="rounded-xl bg-slate-950 p-5 text-white">
                  <p className="text-sm font-semibold text-slate-300">Nilai modal stok</p>
                  <p className="mt-2 text-3xl font-black">{formatRupiah(stats.stockValue)}</p>
                </div>
                <div className="mt-4 grid gap-3">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                      <Tag size={16} />
                      Avg profit/item
                    </span>
                    <span className="font-black text-slate-950">{formatRupiah(stats.sold ? stats.profit / stats.sold : 0)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                      <CircleDollarSign size={16} />
                      Margin
                    </span>
                    <span className="font-black text-slate-950">{stats.revenue ? Math.round((stats.profit / stats.revenue) * 100) : 0}%</span>
                  </div>
                </div>
              </Panel>
            </section>
          )}
        </main>
      </div>

      {soldModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex gap-4">
              <Image src={soldModal.image || defaultImage} alt={soldModal.name} width={160} height={160} unoptimized={Boolean(soldModal.image?.startsWith("data:"))} className="h-20 w-20 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0">
                <h3 className="text-xl font-black text-slate-950">Tandai SOLD</h3>
                <p className="mt-1 truncate text-sm font-medium text-slate-500">{soldModal.code} - {soldModal.name}</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">Modal {formatRupiah(soldModal.costPrice)}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Harga jual aktual
                <input value={soldPrice} onChange={(event) => setSoldPrice(event.target.value.replace(/[^0-9]/g, ""))} placeholder="120000" inputMode="numeric" className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Platform
                <select value={platform} onChange={(event) => setPlatform(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100">
                  <option>Shopee</option>
                  <option>TikTok</option>
                  <option>Instagram</option>
                  <option>Offline</option>
                  <option>Tokopedia</option>
                </select>
              </label>
              <div className="grid gap-3 pt-1 sm:grid-cols-3">
                <Button variant="secondary" onClick={() => setSoldModal(null)}>
                  Batal
                </Button>
                <Button onClick={() => markAsSold(false)} disabled={savingAction === "sold" || savingAction === "sold-print"}>
                  {savingAction === "sold" ? "Menyimpan..." : "Simpan SOLD"}
                </Button>
                <Button onClick={() => markAsSold(true)} disabled={savingAction === "sold" || savingAction === "sold-print"}>
                  <Printer size={16} />
                  {savingAction === "sold-print" ? "Menyimpan..." : "SOLD + Nota"}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {cameraOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="grid w-full max-w-lg gap-4 rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-950">Ambil Foto Realtime</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">Arahkan kamera ke topi, lalu ambil foto.</p>
              </div>
              <Button variant="ghost" onClick={closeRealtimeCamera} className="h-9 px-3">
                Tutup
              </Button>
            </div>

            <video ref={liveVideoRef} playsInline muted autoPlay className="aspect-[4/3] w-full rounded-xl bg-slate-950 object-cover" />

            {cameraError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{cameraError}</p>}

            <div className="grid gap-3 sm:grid-cols-2">
              <Button variant="secondary" onClick={closeRealtimeCamera}>
                Batal
              </Button>
              <Button onClick={captureRealtimePhoto} disabled={!cameraReady}>
                <Camera size={16} />
                {cameraReady ? "Ambil Foto" : "Menyiapkan..."}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
