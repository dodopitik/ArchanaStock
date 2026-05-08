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
  Camera,
  FolderOpen,
  ImagePlus,
  Grid2X2,
  Grid3X3,
  Pencil,
  LayoutDashboard,
  List,
  LogOut,
  Mail,
  PackagePlus,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  TrendingUp,
  User,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

type HatStatus = "AVAILABLE" | "SOLD";
type ViewKey = "dashboard" | "add" | "stock" | "users" | "reports";
type StockView = "list" | "grid2" | "grid4";
type ManagedUserStatus = "ACTIVE" | "INACTIVE";

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

type ManagedUser = {
  id: string;
  authUserId: string | null;
  name: string;
  email: string;
  role: string;
  status: ManagedUserStatus;
  createdAt: string;
};

type ApiManagedUser = {
  id: string;
  authUserId: string | null;
  name: string;
  email: string;
  role: string;
  status: ManagedUserStatus;
  createdAt: string;
};

type FormState = {
  name: string;
  costPrice: string;
  image: string;
};

type UserFormState = {
  name: string;
  email: string;
  password: string;
  role: string;
  status: ManagedUserStatus;
};

type ReportFormState = {
  soldPrice: string;
  platform: string;
  soldAt: string;
};

type BulkItem = {
  name: string;
  costPrice: number;
};

type LoginMode = "login" | "register";
type ImageTarget = "add" | "edit";
type ChartPoint = {
  label: string;
  value: number;
  helper: string;
};
type ReportPeriod = "daily" | "weekly" | "monthly";

type ReportRange = {
  title: string;
  subtitle: string;
  start: string;
  end: string;
  fileName: string;
};

type AuthLikeUser = {
  app_metadata?: Record<string, unknown>;
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

const initialUsers: ManagedUser[] = [
  {
    id: "demo-user-1",
    authUserId: null,
    name: "Admin Archana",
    email: "admin@archanacaps.test",
    role: "Owner",
    status: "ACTIVE",
    createdAt: "2026-05-01T00:00:00+07:00",
  },
  {
    id: "demo-user-2",
    authUserId: null,
    name: "Staff Packing",
    email: "staff@archanacaps.test",
    role: "Staff",
    status: "ACTIVE",
    createdAt: "2026-05-02T00:00:00+07:00",
  },
];

const emptyForm: FormState = {
  name: "",
  costPrice: "",
  image: "",
};

const emptyUserForm: UserFormState = {
  name: "",
  email: "",
  password: "",
  role: "Staff",
  status: "ACTIVE",
};

const emptyReportForm: ReportFormState = {
  soldPrice: "",
  platform: "Shopee",
  soldAt: "",
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

function mapApiManagedUser(row: ApiManagedUser): ManagedUser {
  return {
    id: row.id,
    authUserId: row.authUserId,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt,
  };
}

async function getAccessToken(supabase: ReturnType<typeof getSupabaseClient>) {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

function canManageUsers(user: AuthLikeUser | null | undefined) {
  if (!user) return false;
  const createdBy = user.app_metadata?.created_by;
  const role = user.app_metadata?.role;
  return typeof createdBy !== "string" || role === "Owner" || role === "Admin";
}

function canManageReports(user: AuthLikeUser | null | undefined) {
  if (!user) return false;
  const createdBy = user.app_metadata?.created_by;
  const role = user.app_metadata?.role;
  return typeof createdBy !== "string" || role === "Owner";
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

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parseDateInputValue(value));
}

function getReportRange(period: ReportPeriod): ReportRange {
  const today = new Date();
  const todayValue = toDateInputValue(today);

  if (period === "daily") {
    return {
      title: "Laporan Harian",
      subtitle: formatDisplayDate(todayValue),
      start: todayValue,
      end: todayValue,
      fileName: `archana-caps-laporan-harian-${todayValue}`,
    };
  }

  if (period === "weekly") {
    const startDate = new Date(today);
    const day = startDate.getDay() || 7;
    startDate.setDate(startDate.getDate() - day + 1);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const start = toDateInputValue(startDate);
    const end = toDateInputValue(endDate);

    return {
      title: "Laporan Mingguan",
      subtitle: `${formatDisplayDate(start)} - ${formatDisplayDate(end)}`,
      start,
      end,
      fileName: `archana-caps-laporan-mingguan-${start}`,
    };
  }

  const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const start = toDateInputValue(startDate);
  const end = toDateInputValue(endDate);

  return {
    title: "Laporan Bulanan",
    subtitle: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(today),
    start,
    end,
    fileName: `archana-caps-laporan-bulanan-${start.slice(0, 7)}`,
  };
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
              <Image src={logoSrc} alt={storeName} width={320} height={240} className="h-auto w-44 object-contain sm:w-56" priority />
              <p className="mt-8 text-sm font-black uppercase text-red-300">Inventory Dashboard</p>
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
  const [users, setUsers] = useState<ManagedUser[]>(initialUsers);
  const [query, setQuery] = useState("");
  const [soldModal, setSoldModal] = useState<Hat | null>(null);
  const [editModal, setEditModal] = useState<Hat | null>(null);
  const [reportEditModal, setReportEditModal] = useState<Hat | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [reportForm, setReportForm] = useState<ReportFormState>(emptyReportForm);
  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [soldPrice, setSoldPrice] = useState("");
  const [platform, setPlatform] = useState("Shopee");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [bulkText, setBulkText] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginMode, setLoginMode] = useState<LoginMode>("login");
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [canManageUserMenu, setCanManageUserMenu] = useState(false);
  const [canManageReportActions, setCanManageReportActions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [dbMessage, setDbMessage] = useState(isSupabaseConfigured ? "Menunggu login Supabase." : "Mode demo lokal.");
  const [savingAction, setSavingAction] = useState<"single" | "bulk" | "sold" | "sold-print" | "edit" | "user" | "report-edit" | "report-cancel" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [imageTarget, setImageTarget] = useState<ImageTarget>("add");
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const editGalleryInputRef = useRef<HTMLInputElement>(null);
  const editCameraInputRef = useRef<HTMLInputElement>(null);
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

    const token = await getAccessToken(supabase);
    if (!token) {
      setDbMessage("Login Supabase dulu untuk memuat stok.");
      setDataLoading(false);
      return;
    }

    const response = await fetch("/api/hats", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();

    if (!response.ok) {
      setDbMessage(`Database error: ${result.error || "Server error"}`);
    } else {
      setHats((result.hats || []).map((row: DbHat) => mapDbHat(row)));
      setDbMessage("Tersambung ke Supabase.");
    }

    setDataLoading(false);
  }, [supabase]);

  const loadUsers = useCallback(async () => {
    if (!supabase) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;

    const response = await fetch("/api/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();

    if (!response.ok) {
      setDbMessage(`Gagal load user: ${result.error || "Server error"}`);
      return;
    }

    setUsers((result.users || []).map((row: ApiManagedUser) => mapApiManagedUser(row)));
  }, [supabase]);

  const refreshData = useCallback(async () => {
    if (!supabase) return;
    setDataLoading(true);
    await Promise.all([loadHats(), loadUsers()]);
    setDataLoading(false);
  }, [loadHats, loadUsers, supabase]);

  async function handleAuth() {
    setMessage("");
    setLoading(true);

    if (!supabase) {
      window.localStorage.setItem("archana-caps-demo-user", email);
      setCurrentUser(email);
      setCanManageReportActions(true);
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
    } else if (result.data.user?.app_metadata?.status === "INACTIVE") {
      await supabase.auth.signOut();
      setMessage("User ini sedang nonaktif. Hubungi admin toko.");
    } else {
      setCurrentUser(result.data.user?.email || email);
      setCanManageUserMenu(canManageUsers(result.data.user));
      setCanManageReportActions(canManageReports(result.data.user));
      if (!canManageUsers(result.data.user)) setActiveView("dashboard");
      setDbMessage(loginMode === "register" ? "Akun dibuat. Cek email jika konfirmasi aktif di Supabase." : "Login Supabase berhasil.");
    }

    setLoading(false);
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    window.localStorage.removeItem("archana-caps-demo-user");
    setCurrentUser(null);
    setCanManageUserMenu(false);
    setCanManageReportActions(false);
    setHats(initialHats);
    setUsers(initialUsers);
    setActiveView("dashboard");
  }

  useEffect(() => {
    if (!supabase) {
      const demoUser = window.localStorage.getItem("archana-caps-demo-user");
      if (demoUser) {
        queueMicrotask(() => {
          setCurrentUser(demoUser);
          setCanManageReportActions(true);
        });
      }
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user.app_metadata?.status === "INACTIVE") {
        void supabase.auth.signOut();
        setMessage("User ini sedang nonaktif. Hubungi admin toko.");
        return;
      }
      setCurrentUser(data.session?.user.email || null);
      setCanManageUserMenu(canManageUsers(data.session?.user));
      setCanManageReportActions(canManageReports(data.session?.user));
      if (!canManageUsers(data.session?.user)) setActiveView("dashboard");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.app_metadata?.status === "INACTIVE") {
        void supabase.auth.signOut();
        setCurrentUser(null);
        setCanManageReportActions(false);
        setMessage("User ini sedang nonaktif. Hubungi admin toko.");
        return;
      }
      setCurrentUser(session?.user.email || null);
      setCanManageUserMenu(canManageUsers(session?.user));
      setCanManageReportActions(canManageReports(session?.user));
      if (!canManageUsers(session?.user)) setActiveView("dashboard");
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!currentUser || !supabase) return;
    queueMicrotask(() => void refreshData());
  }, [currentUser, refreshData, supabase]);

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

  function updateEditForm(key: keyof FormState, value: string) {
    setEditForm((current) => ({ ...current, [key]: value }));
  }

  function updateReportForm(key: keyof ReportFormState, value: string) {
    setReportForm((current) => ({ ...current, [key]: value }));
  }

  function updateUserForm(key: keyof UserFormState, value: string) {
    setUserForm((current) => ({ ...current, [key]: value }));
  }

  function setTargetImage(value: string) {
    if (imageTarget === "edit") {
      updateEditForm("image", value);
      return;
    }

    updateForm("image", value);
  }

  async function handleImageFile(file: File | undefined, target: ImageTarget = imageTarget) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setDbMessage("File harus berupa gambar.");
      return;
    }

    try {
      const image = await resizeImageFile(file);
      if (target === "edit") {
        updateEditForm("image", image);
      } else {
        updateForm("image", image);
      }
      setDbMessage("Foto siap disimpan bersama item.");
    } catch (error) {
      setDbMessage(error instanceof Error ? error.message : "Gagal memproses foto.");
    }
  }

  function clearFormImage(target: ImageTarget = "add") {
    if (target === "edit") {
      updateEditForm("image", "");
    } else {
      updateForm("image", "");
    }

    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (editGalleryInputRef.current) editGalleryInputRef.current.value = "";
    if (editCameraInputRef.current) editCameraInputRef.current.value = "";
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

  async function openRealtimeCamera(target: ImageTarget = "add") {
    setCameraError("");
    setCameraReady(false);
    setImageTarget(target);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Browser belum mendukung kamera realtime. Pakai opsi kamera file sebagai fallback.");
      (target === "edit" ? editCameraInputRef.current : cameraInputRef.current)?.click();
      return;
    }

    if (!window.isSecureContext) {
      setCameraError("Kamera realtime butuh HTTPS atau localhost. Jika dibuka dari IP http://172.24.0.1, browser biasanya memblokir kamera.");
      (target === "edit" ? editCameraInputRef.current : cameraInputRef.current)?.click();
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
      (target === "edit" ? editCameraInputRef.current : cameraInputRef.current)?.click();
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
    setTargetImage(canvas.toDataURL("image/jpeg", 0.82));
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
      const token = await getAccessToken(supabase);
      if (!token) {
        setDbMessage("Login Supabase dulu sebelum menyimpan item.");
        return false;
      }

      const rows = newHats.map((hat) => ({
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

      const response = await fetch("/api/hats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rows }),
      });
      const result = await response.json();

      if (!response.ok) {
        setDbMessage(`Gagal simpan: ${result.error || "Server error"}`);
        return false;
      }

      setHats((current) => [...(result.hats || []).map((row: DbHat) => mapDbHat(row)), ...current]);
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
      const token = await getAccessToken(supabase);
      if (!token) {
        setDbMessage("Login Supabase dulu sebelum update sold.");
        setSavingAction(null);
        return;
      }

      const response = await fetch("/api/hats", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: soldModal.id, updates }),
      });
      const result = await response.json();

      if (!response.ok) {
        setDbMessage(`Gagal update sold: ${result.error || "Server error"}`);
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
      const token = await getAccessToken(supabase);
      if (!token) {
        setDbMessage("Login Supabase dulu sebelum hapus item.");
        setDeletingId(null);
        return;
      }

      const response = await fetch("/api/hats", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: hat.id }),
      });
      const result = await response.json();

      if (!response.ok) {
        setDbMessage(`Gagal hapus item: ${result.error || "Server error"}`);
        setDeletingId(null);
        return;
      }
    }

    setHats((current) => current.filter((item) => item.id !== hat.id));
    setDbMessage(`${hat.code} dihapus dari stok.`);
    setDeletingId(null);
  }

  function openEditModal(hat: Hat) {
    setEditModal(hat);
    setEditForm({
      name: hat.name,
      costPrice: String(hat.costPrice),
      image: hat.image || "",
    });
  }

  async function saveEditedHat() {
    if (!editModal || !editForm.name.trim() || !editForm.costPrice) return;

    setSavingAction("edit");

    const updates = {
      name: editForm.name.trim(),
      cost_price: Number(editForm.costPrice),
      image_url: editForm.image.trim() || null,
    };

    if (supabase && !editModal.id.startsWith("demo-") && !editModal.id.startsWith("local-")) {
      const token = await getAccessToken(supabase);
      if (!token) {
        setDbMessage("Login Supabase dulu sebelum edit item.");
        setSavingAction(null);
        return;
      }

      const response = await fetch("/api/hats", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: editModal.id, updates }),
      });
      const result = await response.json();

      if (!response.ok) {
        setDbMessage(`Gagal edit item: ${result.error || "Server error"}`);
        setSavingAction(null);
        return;
      }
    }

    const editedHat: Hat = {
      ...editModal,
      name: updates.name,
      costPrice: updates.cost_price,
      image: updates.image_url,
    };

    setHats((current) => current.map((hat) => (hat.id === editModal.id ? editedHat : hat)));
    setDbMessage(`${editModal.code} berhasil diperbarui.`);
    setEditModal(null);
    setEditForm(emptyForm);
    setSavingAction(null);
  }

  function openReportEditModal(hat: Hat) {
    if (!canManageReportActions) {
      setDbMessage("Hanya Owner yang bisa mengubah laporan SOLD.");
      return;
    }

    setReportEditModal(hat);
    setReportForm({
      soldPrice: String(hat.soldPrice || ""),
      platform: hat.platform || "Shopee",
      soldAt: hat.soldAt || toDateInputValue(new Date()),
    });
  }

  async function saveReportEdit() {
    if (!reportEditModal || !reportForm.soldPrice || !reportForm.soldAt) return;
    if (!canManageReportActions) {
      setDbMessage("Hanya Owner yang bisa mengubah laporan SOLD.");
      return;
    }

    setSavingAction("report-edit");

    const updates = {
      sold_price: Number(reportForm.soldPrice),
      platform: reportForm.platform.trim() || "Lainnya",
      sold_at: reportForm.soldAt,
    };

    if (supabase && !reportEditModal.id.startsWith("demo-") && !reportEditModal.id.startsWith("local-")) {
      const token = await getAccessToken(supabase);
      if (!token) {
        setDbMessage("Login Supabase dulu sebelum edit laporan.");
        setSavingAction(null);
        return;
      }

      const response = await fetch("/api/hats", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: reportEditModal.id, updates, requireOwner: true }),
      });
      const result = await response.json();

      if (!response.ok) {
        setDbMessage(`Gagal edit laporan: ${result.error || "Server error"}`);
        setSavingAction(null);
        return;
      }
    }

    setHats((current) =>
      current.map((hat) =>
        hat.id === reportEditModal.id
          ? {
              ...hat,
              soldPrice: updates.sold_price,
              platform: updates.platform,
              soldAt: updates.sold_at,
            }
          : hat
      )
    );
    setDbMessage(`Laporan ${reportEditModal.code} berhasil diperbarui.`);
    setReportEditModal(null);
    setReportForm(emptyReportForm);
    setSavingAction(null);
  }

  async function cancelReportSale(hat: Hat) {
    if (!canManageReportActions) {
      setDbMessage("Hanya Owner yang bisa menghapus laporan SOLD.");
      return;
    }

    const confirmed = window.confirm(`Batalkan SOLD ${hat.code} - ${hat.name}? Item akan kembali ke stok available dan hilang dari laporan.`);
    if (!confirmed) return;

    setSavingAction("report-cancel");

    const updates = {
      status: "AVAILABLE" as HatStatus,
      sold_price: null,
      platform: "",
      sold_at: null,
    };

    if (supabase && !hat.id.startsWith("demo-") && !hat.id.startsWith("local-")) {
      const token = await getAccessToken(supabase);
      if (!token) {
        setDbMessage("Login Supabase dulu sebelum hapus laporan.");
        setSavingAction(null);
        return;
      }

      const response = await fetch("/api/hats", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: hat.id, updates, requireOwner: true }),
      });
      const result = await response.json();

      if (!response.ok) {
        setDbMessage(`Gagal hapus laporan: ${result.error || "Server error"}`);
        setSavingAction(null);
        return;
      }
    }

    setHats((current) =>
      current.map((item) =>
        item.id === hat.id
          ? {
              ...item,
              status: "AVAILABLE",
              soldPrice: null,
              platform: "",
              soldAt: null,
            }
          : item
      )
    );
    setDbMessage(`Laporan ${hat.code} dihapus. Item kembali ke stok available.`);
    setSavingAction(null);
  }

  function startEditUser(user: ManagedUser) {
    setEditingUserId(user.id);
    setUserForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      status: user.status,
    });
    setActiveView("users");
  }

  function resetUserForm() {
    setEditingUserId(null);
    setUserForm(emptyUserForm);
  }

  async function saveUser() {
    if (!userForm.name.trim() || !userForm.email.trim() || (!editingUserId && userForm.password.length < 6)) return;
    setSavingAction("user");

    const userPayload = {
      name: userForm.name.trim(),
      email: userForm.email.trim(),
      password: userForm.password,
      role: userForm.role.trim() || "Staff",
      status: userForm.status,
    };

    if (supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setDbMessage("Login Supabase dulu sebelum membuat user.");
        setSavingAction(null);
        return;
      }

      const response = await fetch("/api/users", {
        method: editingUserId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editingUserId ? { id: editingUserId, ...userPayload } : userPayload),
      });
      const result = await response.json();

      if (!response.ok) {
        setDbMessage(`Gagal simpan user: ${result.error || "Server error"}`);
        setSavingAction(null);
        return;
      }

      const savedUser = mapApiManagedUser(result.user as ApiManagedUser);
      if (editingUserId) {
        setUsers((current) => current.map((user) => (user.id === editingUserId ? savedUser : user)));
      } else {
        setUsers((current) => [savedUser, ...current]);
      }
    } else if (editingUserId) {
      setUsers((current) =>
        current.map((user) =>
          user.id === editingUserId
            ? { ...user, name: userPayload.name, email: userPayload.email, role: userPayload.role, status: userPayload.status }
            : user
        )
      );
    } else {
      setUsers((current) => [
        {
          id: makeLocalId(),
          authUserId: null,
          name: userPayload.name,
          email: userPayload.email,
          role: userPayload.role,
          status: userPayload.status,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
    }

    setDbMessage(editingUserId ? "User berhasil diperbarui." : "User baru berhasil ditambahkan.");
    resetUserForm();
    setSavingAction(null);
  }

  async function deleteUser(user: ManagedUser) {
    const confirmed = window.confirm(`Hapus user ${user.name}?`);
    if (!confirmed) return;

    setDeletingUserId(user.id);

    if (supabase && !user.id.startsWith("demo-") && !user.id.startsWith("local-")) {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setDbMessage("Login Supabase dulu sebelum menghapus user.");
        setDeletingUserId(null);
        return;
      }

      const response = await fetch("/api/users", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: user.id }),
      });
      const result = await response.json();

      if (!response.ok) {
        setDbMessage(`Gagal hapus user: ${result.error || "Server error"}`);
        setDeletingUserId(null);
        return;
      }
    }

    setUsers((current) => current.filter((item) => item.id !== user.id));
    if (editingUserId === user.id) resetUserForm();
    setDbMessage(`${user.name} dihapus dari daftar user.`);
    setDeletingUserId(null);
  }

  function printSalesReport(period: ReportPeriod) {
    const range = getReportRange(period);
    const reportHats = soldHats
      .filter((hat) => hat.soldAt && hat.soldAt >= range.start && hat.soldAt <= range.end)
      .sort((hatA, hatB) => `${hatA.soldAt || ""}${hatA.code}`.localeCompare(`${hatB.soldAt || ""}${hatB.code}`));
    const revenue = reportHats.reduce((sum, hat) => sum + (hat.soldPrice || 0), 0);
    const cost = reportHats.reduce((sum, hat) => sum + hat.costPrice, 0);
    const profit = revenue - cost;
    const averageProfit = reportHats.length ? profit / reportHats.length : 0;
    const logoUrl = `${window.location.origin}${logoSrc}`;
    const reportWindow = window.open("", "_blank", "width=980,height=720");

    if (!reportWindow) {
      setDbMessage("Popup laporan diblokir browser. Izinkan popup untuk mencetak PDF.");
      return;
    }

    const rows = reportHats
      .map(
        (hat, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>
            <strong>${escapeHtml(hat.code)}</strong>
            <span>${escapeHtml(hat.name)}</span>
          </td>
          <td>${escapeHtml(hat.soldAt ? formatDisplayDate(hat.soldAt) : "-")}</td>
          <td>${escapeHtml(hat.platform || "-")}</td>
          <td class="money">${formatRupiah(hat.costPrice)}</td>
          <td class="money">${formatRupiah(hat.soldPrice)}</td>
          <td class="money strong">${formatRupiah((hat.soldPrice || 0) - hat.costPrice)}</td>
        </tr>`
      )
      .join("");

    reportWindow.document.write(`<!doctype html>
<html>
  <head>
    <title>${escapeHtml(range.fileName)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page { size: A4; margin: 14mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #0f172a;
        background: #f8fafc;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px;
      }
      .sheet {
        width: 100%;
        min-height: 100vh;
        margin: 0 auto;
        background: white;
        padding: 24px;
      }
      .letterhead {
        display: grid;
        grid-template-columns: 96px 1fr;
        gap: 18px;
        align-items: center;
        border-bottom: 3px solid #0f172a;
        padding-bottom: 16px;
      }
      .logo {
        width: 88px;
        height: 88px;
        object-fit: contain;
      }
      .store {
        margin: 0;
        font-size: 28px;
        font-weight: 900;
        letter-spacing: 0;
      }
      .tagline {
        margin: 4px 0 0;
        color: #475569;
        font-weight: 700;
      }
      .meta {
        margin-top: 6px;
        color: #64748b;
        line-height: 1.5;
      }
      .title-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin: 22px 0 16px;
      }
      h2 {
        margin: 0;
        font-size: 22px;
      }
      .period {
        margin-top: 4px;
        color: #64748b;
        font-weight: 700;
      }
      .printed {
        color: #64748b;
        font-size: 11px;
        text-align: right;
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 18px;
      }
      .card {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px;
      }
      .card span {
        display: block;
        color: #64748b;
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
      }
      .card strong {
        display: block;
        margin-top: 6px;
        font-size: 15px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th {
        background: #0f172a;
        color: white;
        font-size: 10px;
        letter-spacing: 0;
        text-align: left;
        text-transform: uppercase;
      }
      th, td {
        border: 1px solid #e2e8f0;
        padding: 9px 8px;
        vertical-align: top;
      }
      td span {
        display: block;
        margin-top: 3px;
        color: #475569;
        font-weight: 700;
      }
      .money {
        text-align: right;
        white-space: nowrap;
      }
      .strong {
        color: #047857;
        font-weight: 900;
      }
      .empty {
        border: 1px dashed #cbd5e1;
        border-radius: 8px;
        color: #64748b;
        font-weight: 700;
        padding: 24px;
        text-align: center;
      }
      .signatures {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 40px;
        margin-top: 34px;
        page-break-inside: avoid;
      }
      .signature {
        text-align: center;
        color: #475569;
        font-weight: 700;
      }
      .signature-line {
        border-top: 1px solid #94a3b8;
        margin: 56px auto 0;
        max-width: 180px;
        padding-top: 8px;
      }
      .screen-actions {
        display: flex;
        gap: 8px;
        margin: 16px auto;
        max-width: 360px;
      }
      button {
        flex: 1;
        height: 42px;
        border: 0;
        border-radius: 8px;
        background: #020617;
        color: white;
        font-weight: 800;
        cursor: pointer;
      }
      @media print {
        body { background: white; }
        .sheet { min-height: auto; padding: 0; }
        .screen-actions { display: none; }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <header class="letterhead">
        <img class="logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(storeName)}" />
        <div>
          <h1 class="store">${escapeHtml(storeName)}</h1>
          <p class="tagline">Inventory dan Laporan Penjualan Topi Thrift</p>
          <p class="meta">Laporan resmi toko untuk rekap omzet, modal, profit, dan transaksi SOLD.</p>
        </div>
      </header>

      <section class="title-row">
        <div>
          <h2>${escapeHtml(range.title)}</h2>
          <div class="period">${escapeHtml(range.subtitle)}</div>
        </div>
        <div class="printed">Dicetak<br />${escapeHtml(new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeStyle: "short" }).format(new Date()))}</div>
      </section>

      <section class="summary">
        <div class="card"><span>Item Terjual</span><strong>${reportHats.length} pcs</strong></div>
        <div class="card"><span>Omzet</span><strong>${formatRupiah(revenue)}</strong></div>
        <div class="card"><span>Modal</span><strong>${formatRupiah(cost)}</strong></div>
        <div class="card"><span>Profit Kotor</span><strong>${formatRupiah(profit)}</strong></div>
      </section>

      ${
        reportHats.length
          ? `<table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Item</th>
                  <th>Tanggal</th>
                  <th>Platform</th>
                  <th>Modal</th>
                  <th>Jual</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>`
          : `<div class="empty">Belum ada item SOLD pada periode laporan ini.</div>`
      }

      <section class="summary" style="margin-top: 18px;">
        <div class="card"><span>Avg Profit/Item</span><strong>${formatRupiah(averageProfit)}</strong></div>
        <div class="card"><span>Margin</span><strong>${revenue ? Math.round((profit / revenue) * 100) : 0}%</strong></div>
        <div class="card"><span>Periode Mulai</span><strong>${escapeHtml(formatDisplayDate(range.start))}</strong></div>
        <div class="card"><span>Periode Akhir</span><strong>${escapeHtml(formatDisplayDate(range.end))}</strong></div>
      </section>

      <section class="signatures">
        <div class="signature">
          Dibuat oleh
          <div class="signature-line">Admin</div>
        </div>
        <div class="signature">
          Mengetahui
          <div class="signature-line">Owner</div>
        </div>
      </section>
    </main>
    <div class="screen-actions">
      <button onclick="window.print()">Cetak / Save PDF</button>
      <button onclick="window.close()">Tutup</button>
    </div>
    <script>
      window.addEventListener("load", () => setTimeout(() => window.print(), 300));
    </script>
  </body>
</html>`);
    reportWindow.document.close();
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
    ...(canManageUserMenu ? [{ key: "users" as ViewKey, label: "User", icon: Users }] : []),
    { key: "reports", label: "Laporan", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto grid w-full max-w-7xl gap-4 p-3 sm:p-4 md:gap-5 md:p-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6">
          <div className="grid gap-3 border-b border-slate-100 pb-4">
            <Image src={logoSrc} alt={storeName} width={220} height={160} className="h-auto w-36 object-contain" priority />
            <p className="truncate text-xs font-medium text-slate-500">{currentUser}</p>
          </div>

          <nav className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-1">
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
            <Button variant="secondary" onClick={refreshData} disabled={!supabase || dataLoading}>
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
                    <Button variant="secondary" onClick={() => printSalesReport("monthly")} className="w-full border-white/15 bg-white text-slate-950 hover:bg-slate-100">
                      <Printer size={17} />
                      Cetak PDF Bulanan
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
                    onChange={(event) => void handleImageFile(event.target.files?.[0], "add")}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => void handleImageFile(event.target.files?.[0], "add")}
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
                        <Button variant="secondary" onClick={() => openRealtimeCamera("add")}>
                          <Camera size={16} />
                          Kamera
                        </Button>
                      </div>
                      {cameraError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">{cameraError}</p>}
                      {form.image && (
                        <Button variant="ghost" onClick={() => clearFormImage("add")} className="h-9 justify-self-start px-3">
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
                    <div className={stockView === "list" ? "grid min-w-[270px] gap-2 sm:grid-cols-3" : "m-3 mt-0 grid grid-cols-3 gap-1.5"}>
                      <Button
                        variant="secondary"
                        onClick={() => openEditModal(hat)}
                        title="Edit item"
                        aria-label={`Edit ${hat.name}`}
                        className={stockView === "list" ? "h-10 w-full px-3" : "h-9 w-full px-2 text-xs"}
                      >
                        <Pencil size={16} />
                        <span className={stockView === "list" ? "" : "sr-only"}>Edit</span>
                      </Button>
                      <Button
                        onClick={() => setSoldModal(hat)}
                        title="Tandai SOLD"
                        aria-label={`Tandai ${hat.name} SOLD`}
                        className={stockView === "list" ? "h-10 w-full px-3" : "h-9 w-full px-2 text-xs"}
                      >
                        <CheckCircle2 size={16} />
                        <span className={stockView === "list" ? "" : "sr-only"}>SOLD</span>
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => void deleteHat(hat)}
                        disabled={deletingId === hat.id}
                        title="Hapus item"
                        aria-label={`Hapus ${hat.name}`}
                        className={stockView === "list" ? "h-10 w-full px-3" : "h-9 w-full px-2 text-xs"}
                      >
                        <Trash2 size={16} />
                        <span className={stockView === "list" ? "" : "sr-only"}>{deletingId === hat.id ? "Hapus..." : "Hapus"}</span>
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

          {activeView === "users" && (
            <section className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
              <Panel className="p-4 sm:p-5">
                <SectionHeader
                  icon={editingUserId ? Pencil : UserPlus}
                  title={editingUserId ? "Edit User" : "Tambah User"}
                  description="Kelola daftar user internal toko untuk operasional dashboard."
                />

                <div className="grid gap-4">
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Nama user
                    <input
                      value={userForm.name}
                      onChange={(event) => updateUserForm("name", event.target.value)}
                      placeholder="Nama staff"
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Email
                    <input
                      value={userForm.email}
                      onChange={(event) => updateUserForm("email", event.target.value)}
                      placeholder="staff@archanacaps.test"
                      type="email"
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Password {editingUserId ? "baru opsional" : ""}
                    <input
                      value={userForm.password}
                      onChange={(event) => updateUserForm("password", event.target.value)}
                      placeholder={editingUserId ? "Kosongkan jika tidak diganti" : "Minimal 6 karakter"}
                      type="password"
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Role
                    <select
                      value={userForm.role}
                      onChange={(event) => updateUserForm("role", event.target.value)}
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                    >
                      <option>Owner</option>
                      <option>Admin</option>
                      <option>Staff</option>
                      <option>Kasir</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Status
                    <select
                      value={userForm.status}
                      onChange={(event) => updateUserForm("status", event.target.value as ManagedUserStatus)}
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                    >
                      <option value="ACTIVE">Aktif</option>
                      <option value="INACTIVE">Nonaktif</option>
                    </select>
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <Button variant="secondary" onClick={resetUserForm} disabled={!editingUserId && !userForm.name && !userForm.email}>
                      Batal
                    </Button>
                    <Button
                      onClick={saveUser}
                      disabled={savingAction === "user" || !userForm.name.trim() || !userForm.email.trim() || (!editingUserId && userForm.password.length < 6)}
                    >
                      <UserPlus size={16} />
                      {savingAction === "user" ? "Menyimpan..." : editingUserId ? "Simpan Edit" : "Tambah User"}
                    </Button>
                  </div>
                </div>
              </Panel>

              <Panel className="p-4 sm:p-5">
                <SectionHeader icon={Users} title="Daftar User" description="Edit role, nonaktifkan, atau hapus user dari daftar operasional." />

                <div className="grid gap-3 lg:hidden">
                  {users.map((user) => (
                    <article key={user.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-black text-slate-950">{user.name}</h3>
                          <p className="mt-1 flex items-center gap-2 truncate text-sm font-medium text-slate-500">
                            <Mail size={14} />
                            {user.email}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${user.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {user.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                          <ShieldCheck size={14} />
                          {user.role}
                        </span>
                        <div className="flex gap-2">
                          <Button variant="secondary" onClick={() => startEditUser(user)} className="h-9 px-3">
                            <Pencil size={15} />
                          </Button>
                          <Button variant="secondary" onClick={() => void deleteUser(user)} disabled={deletingUserId === user.id} className="h-9 px-3">
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto rounded-xl border border-slate-200 lg:block">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td className="px-4 py-4">
                            <p className="font-bold text-slate-950">{user.name}</p>
                            <p className="mt-1 text-xs font-medium text-slate-400">{user.email}</p>
                          </td>
                          <td className="px-4 py-4 font-semibold text-slate-600">{user.role}</td>
                          <td className="px-4 py-4">
                            <span className={`rounded-full px-3 py-1 text-xs font-black ${user.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                              {user.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex gap-2">
                              <Button variant="secondary" onClick={() => startEditUser(user)} className="h-9 px-3">
                                <Pencil size={15} />
                                Edit
                              </Button>
                              <Button variant="secondary" onClick={() => void deleteUser(user)} disabled={deletingUserId === user.id} className="h-9 px-3">
                                <Trash2 size={15} />
                                {deletingUserId === user.id ? "Hapus..." : "Hapus"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!users.length && (
                        <tr>
                          <td colSpan={4} className="px-4 py-10 text-center text-sm font-medium text-slate-500">
                            Belum ada user.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </section>
          )}

          {(activeView === "dashboard" || activeView === "reports") && (
            <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
              <Panel className="p-4 sm:p-5">
                <SectionHeader
                  icon={BarChart3}
                  title="Laporan Penjualan"
                  description="Data item terjual dan profit per item."
                  action={
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Button variant="secondary" onClick={() => printSalesReport("daily")} className="w-full whitespace-nowrap px-3">
                        <Printer size={16} />
                        Harian
                      </Button>
                      <Button variant="secondary" onClick={() => printSalesReport("weekly")} className="w-full whitespace-nowrap px-3">
                        <Printer size={16} />
                        Mingguan
                      </Button>
                      <Button variant="secondary" onClick={() => printSalesReport("monthly")} className="w-full whitespace-nowrap px-3">
                        <Printer size={16} />
                        Bulanan
                      </Button>
                    </div>
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
                        <div className="flex shrink-0 gap-1.5">
                          <Button variant="secondary" onClick={() => printReceipt(hat)} className="h-9 px-3">
                            <Printer size={15} />
                          </Button>
                          {canManageReportActions && (
                            <>
                              <Button variant="secondary" onClick={() => openReportEditModal(hat)} className="h-9 px-3" title="Edit laporan" aria-label={`Edit laporan ${hat.name}`}>
                                <Pencil size={15} />
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => void cancelReportSale(hat)}
                                disabled={savingAction === "report-cancel"}
                                className="h-9 px-3"
                                title="Hapus laporan"
                                aria-label={`Hapus laporan ${hat.name}`}
                              >
                                <Trash2 size={15} />
                              </Button>
                            </>
                          )}
                        </div>
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
                        {canManageReportActions && <th className="px-4 py-3">Aksi Owner</th>}
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
                          {canManageReportActions && (
                            <td className="px-4 py-4">
                              <div className="flex gap-2">
                                <Button variant="secondary" onClick={() => openReportEditModal(hat)} className="h-9 px-3">
                                  <Pencil size={15} />
                                  Edit
                                </Button>
                                <Button variant="secondary" onClick={() => void cancelReportSale(hat)} disabled={savingAction === "report-cancel"} className="h-9 px-3">
                                  <Trash2 size={15} />
                                  Hapus
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                      {!soldHats.length && (
                        <tr>
                          <td colSpan={canManageReportActions ? 7 : 6} className="px-4 py-10 text-center text-sm font-medium text-slate-500">
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

      {reportEditModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex gap-4">
              <Image src={reportEditModal.image || defaultImage} alt={reportEditModal.name} width={160} height={160} unoptimized={Boolean(reportEditModal.image?.startsWith("data:"))} className="h-20 w-20 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0">
                <h3 className="text-xl font-black text-slate-950">Edit Laporan SOLD</h3>
                <p className="mt-1 truncate text-sm font-medium text-slate-500">{reportEditModal.code} - {reportEditModal.name}</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">Khusus Owner</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Harga jual
                <input value={reportForm.soldPrice} onChange={(event) => updateReportForm("soldPrice", event.target.value.replace(/[^0-9]/g, ""))} placeholder="120000" inputMode="numeric" className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Tanggal SOLD
                <input value={reportForm.soldAt} onChange={(event) => updateReportForm("soldAt", event.target.value)} type="date" className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Platform
                <select value={reportForm.platform} onChange={(event) => updateReportForm("platform", event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100">
                  <option>Shopee</option>
                  <option>TikTok</option>
                  <option>Instagram</option>
                  <option>Offline</option>
                  <option>Tokopedia</option>
                  <option>Lainnya</option>
                </select>
              </label>

              <div className="grid gap-3 pt-1 sm:grid-cols-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setReportEditModal(null);
                    setReportForm(emptyReportForm);
                  }}
                >
                  Batal
                </Button>
                <Button onClick={() => void saveReportEdit()} disabled={savingAction === "report-edit" || !reportForm.soldPrice || !reportForm.soldAt}>
                  {savingAction === "report-edit" ? "Menyimpan..." : "Simpan Laporan"}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="grid w-full max-w-lg gap-4 rounded-2xl bg-white p-5 shadow-2xl">
            <div>
              <h3 className="text-xl font-black text-slate-950">Edit Stok Topi</h3>
              <p className="mt-1 text-sm font-medium text-slate-500">{editModal.code}</p>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Nama topi
                <input value={editForm.name} onChange={(event) => updateEditForm("name", event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Harga modal
                <input value={editForm.costPrice} onChange={(event) => updateEditForm("costPrice", event.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                URL foto opsional
                <input value={editForm.image} onChange={(event) => updateEditForm("image", event.target.value)} placeholder="Kosongkan jika belum ada foto" className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" />
              </label>

              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <input ref={editGalleryInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleImageFile(event.target.files?.[0], "edit")} />
                <input ref={editCameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => void handleImageFile(event.target.files?.[0], "edit")} />

                <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-center">
                  <Image
                    src={editForm.image || defaultImage}
                    alt="Preview foto edit"
                    width={240}
                    height={180}
                    className="aspect-[4/3] w-full rounded-lg object-cover sm:w-[120px]"
                    unoptimized={editForm.image.startsWith("data:")}
                  />
                  <div className="grid gap-3">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Button variant="secondary" onClick={() => editGalleryInputRef.current?.click()}>
                        <FolderOpen size={16} />
                        Galeri
                      </Button>
                      <Button variant="secondary" onClick={() => editGalleryInputRef.current?.click()}>
                        <ImagePlus size={16} />
                        File
                      </Button>
                      <Button variant="secondary" onClick={() => openRealtimeCamera("edit")}>
                        <Camera size={16} />
                        Kamera
                      </Button>
                    </div>
                    {editForm.image && (
                      <Button variant="ghost" onClick={() => clearFormImage("edit")} className="h-9 justify-self-start px-3">
                        Hapus foto
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditModal(null);
                  setEditForm(emptyForm);
                }}
              >
                Batal
              </Button>
              <Button onClick={saveEditedHat} disabled={savingAction === "edit" || !editForm.name.trim() || !editForm.costPrice}>
                {savingAction === "edit" ? "Menyimpan..." : "Simpan Edit"}
              </Button>
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
