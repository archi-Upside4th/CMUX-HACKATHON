"use client";

/**
 * SourcePicker — Layer B 입력 소스 선택.
 *
 * 두 모드:
 *   - URL: GitHub 저장소 git clone
 *   - ZIP: 로컬 zip 업로드 (사내 코드용 — 외부 접근 불가)
 *
 * 부모는 SourceSelection 객체를 받아 multipart/JSON 분기에 활용.
 */
import { useRef, useState } from "react";

export type SourceSelection =
  | { kind: "url"; url: string }
  | { kind: "zip"; file: File };

interface Props {
  value: SourceSelection | null;
  onChange: (next: SourceSelection | null) => void;
  disabled?: boolean;
}

const ZIP_MAX_BYTES = 100 * 1024 * 1024; // 100MB hard limit (API also enforces)

export function SourcePicker({ value, onChange, disabled }: Props) {
  const [tab, setTab] = useState<"url" | "zip">(
    value?.kind === "zip" ? "zip" : "url"
  );
  const [url, setUrl] = useState(value?.kind === "url" ? value.url : "");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function switchTab(t: "url" | "zip") {
    setTab(t);
    setError(null);
    if (t === "url") {
      onChange(url.trim() ? { kind: "url", url: url.trim() } : null);
    } else if (value?.kind !== "zip") {
      onChange(null);
    }
  }

  function commitUrl(next: string) {
    setUrl(next);
    const trimmed = next.trim();
    if (!trimmed) {
      onChange(null);
      return;
    }
    onChange({ kind: "url", url: trimmed });
  }

  function acceptFile(file: File) {
    if (!/\.zip$/i.test(file.name)) {
      setError(".zip 파일만 허용됩니다");
      return;
    }
    if (file.size > ZIP_MAX_BYTES) {
      setError(
        `ZIP은 100MB 이하만 가능 (선택한 파일: ${(file.size / 1024 / 1024).toFixed(1)}MB)`
      );
      return;
    }
    setError(null);
    onChange({ kind: "zip", file });
  }

  function clearZip() {
    onChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
        <TabButton
          active={tab === "url"}
          onClick={() => switchTab("url")}
          disabled={disabled}
          label="GitHub URL"
        />
        <TabButton
          active={tab === "zip"}
          onClick={() => switchTab("zip")}
          disabled={disabled}
          label="ZIP 업로드"
          badge="사내 코드"
        />
      </div>

      {tab === "url" ? (
        <div className="space-y-2">
          <label htmlFor="repoUrl" className="sr-only">
            GitHub URL
          </label>
          <input
            id="repoUrl"
            type="url"
            value={url}
            disabled={disabled}
            onChange={(e) => commitUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none disabled:opacity-60"
          />
          <p className="text-xs text-slate-500">
            공개(public) 저장소만 지원. private는 ZIP으로 업로드.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            disabled={disabled}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) acceptFile(f);
            }}
            className="hidden"
          />
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!disabled) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (disabled) return;
              const f = e.dataTransfer.files?.[0];
              if (f) acceptFile(f);
            }}
            className={`border-2 border-dashed rounded-md px-4 py-6 text-center transition ${
              dragging
                ? "border-blue-500 bg-blue-50"
                : "border-slate-300 bg-slate-50"
            } ${disabled ? "opacity-60" : ""}`}
          >
            {value?.kind === "zip" ? (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-slate-900">
                  📦 {value.file.name}
                </p>
                <p className="text-xs text-slate-500">
                  {(value.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <div className="flex justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled}
                    className="text-xs px-2.5 py-1 rounded border border-slate-300 hover:bg-white"
                  >
                    다른 파일
                  </button>
                  <button
                    type="button"
                    onClick={clearZip}
                    disabled={disabled}
                    className="text-xs px-2.5 py-1 rounded border border-slate-300 text-slate-600 hover:bg-white"
                  >
                    제거
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-700">
                  ZIP 파일을 끌어다 놓거나
                </p>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:border-slate-400"
                >
                  파일 선택
                </button>
                <p className="text-xs text-slate-500">
                  최대 100MB · src 디렉토리만 압축해도 OK
                </p>
              </div>
            )}
          </div>
          {error ? (
            <p className="text-xs text-red-600 font-medium">{error}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  disabled,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3.5 py-1.5 text-sm flex items-center gap-1.5 transition ${
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-700 hover:bg-slate-50"
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      {label}
      {badge ? (
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${
            active
              ? "bg-white/20 text-white"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}
