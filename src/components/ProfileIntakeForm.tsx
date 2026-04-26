"use client";

/**
 * Layer A — Service Profile Intake form.
 *
 * 11문항 controlled form. 부모는 onChange 콜백으로 ServiceProfileIntake를 받는다.
 * Zod 스키마(ServiceProfileIntakeSchema)와 1:1 대응.
 *
 * 최소 정보 원칙: 명확한 분기에 영향을 주는 11개 필드만 받는다.
 * 회사명/제품명 등 식별자는 PDF 헤더에서만 별도 수집(이 폼은 판정용).
 */
import { useId } from "react";
import type {
  ServiceProfileIntake,
  ServiceType,
  UserResidency,
  DeploymentRegion,
  AutomationLevel,
  HighImpactDomain,
  ServiceStatus,
} from "@/lib/scan/profile/schema";

interface Props {
  value: ServiceProfileIntake;
  onChange: (next: ServiceProfileIntake) => void;
  disabled?: boolean;
}

// ──────────────────────────────────────────────────────────
// 라벨/옵션
// ──────────────────────────────────────────────────────────

const SERVICE_TYPE_OPTIONS: Array<{ value: ServiceType; label: string; hint: string }> = [
  { value: "B2C", label: "B2C", hint: "일반 소비자 대상" },
  { value: "B2B", label: "B2B", hint: "기업 고객 대상" },
  { value: "B2G", label: "B2G", hint: "정부/공공 납품" },
  { value: "INTERNAL", label: "사내", hint: "내부 직원만 사용" },
];

const USER_RESIDENCY_OPTIONS: Array<{ value: UserResidency; label: string }> = [
  { value: "KR_ONLY", label: "한국 거주자만" },
  { value: "OVERSEAS_ONLY", label: "해외 거주자만" },
  { value: "MIXED", label: "혼재" },
];

const DEPLOYMENT_OPTIONS: Array<{ value: DeploymentRegion; label: string; hint: string }> = [
  { value: "KR", label: "국내", hint: "AWS Seoul / NCP / KT 등" },
  { value: "OVERSEAS", label: "해외", hint: "us-east 등 해외 단일" },
  { value: "MULTI", label: "멀티리전", hint: "국내+해외 동시" },
];

const AUTOMATION_OPTIONS: Array<{ value: AutomationLevel; label: string; hint: string }> = [
  { value: "INFO_ONLY", label: "정보 제공만", hint: "결정에 관여하지 않음" },
  { value: "RECOMMENDATION", label: "추천 (사람 결정)", hint: "최종 결정은 사람이" },
  { value: "AUTOMATED", label: "완전 자동", hint: "AI가 단독으로 결정" },
];

const HIGH_IMPACT_OPTIONS: Array<{ value: HighImpactDomain; label: string }> = [
  { value: "MEDICAL", label: "의료" },
  { value: "FINANCE", label: "금융" },
  { value: "HIRING", label: "채용/인사" },
  { value: "JUDICIAL", label: "사법/법집행" },
  { value: "PUBLIC", label: "공공서비스" },
  { value: "ESSENTIALS", label: "필수재 (전기/가스/통신)" },
  { value: "EDUCATION", label: "교육 평가" },
  { value: "ENERGY", label: "에너지/환경 인프라" },
];

const STATUS_OPTIONS: Array<{ value: ServiceStatus; label: string; hint: string }> = [
  { value: "EXISTING", label: "기존 서비스", hint: "2026-01-22 이전부터 운영" },
  { value: "NEW_LAUNCH", label: "신규 출시", hint: "시행일 이후 신규 런칭" },
];

// ──────────────────────────────────────────────────────────
// 컴포넌트
// ──────────────────────────────────────────────────────────

export function ProfileIntakeForm({ value, onChange, disabled }: Props) {
  function patch(partial: Partial<ServiceProfileIntake>) {
    onChange({ ...value, ...partial });
  }

  function patchPersonal(p: Partial<ServiceProfileIntake["personalData"]>) {
    onChange({
      ...value,
      personalData: { ...value.personalData, ...p },
    });
  }
  function patchScale(p: Partial<ServiceProfileIntake["scale"]>) {
    onChange({ ...value, scale: { ...value.scale, ...p } });
  }
  function patchOrg(p: Partial<ServiceProfileIntake["organization"]>) {
    onChange({
      ...value,
      organization: { ...value.organization, ...p },
    });
  }
  function patchAssess(p: Partial<ServiceProfileIntake["assessments"]>) {
    onChange({
      ...value,
      assessments: { ...value.assessments, ...p },
    });
  }

  function toggleHighImpact(domain: HighImpactDomain) {
    const has = value.highImpactDomains.includes(domain);
    onChange({
      ...value,
      highImpactDomains: has
        ? value.highImpactDomains.filter((d) => d !== domain)
        : [...value.highImpactDomains, domain],
    });
  }

  return (
    <fieldset disabled={disabled} className="space-y-8">
      <Section
        no="①"
        title="서비스 정의"
        hint="누가 어디서 쓰는 서비스인가"
      >
        <SegmentedField
          label="1. 서비스 형태"
          options={SERVICE_TYPE_OPTIONS}
          value={value.serviceType}
          onChange={(v) => patch({ serviceType: v })}
        />
        <SegmentedField
          label="2. 이용자 거주지"
          options={USER_RESIDENCY_OPTIONS}
          value={value.userResidency}
          onChange={(v) => patch({ userResidency: v })}
        />
        <SegmentedField
          label="3. 배포 리전"
          options={DEPLOYMENT_OPTIONS}
          value={value.deploymentRegion}
          onChange={(v) => patch({ deploymentRegion: v })}
        />
      </Section>

      <Section
        no="②"
        title="데이터"
        hint="개인정보 처리 및 국외이전 여부"
      >
        <CheckboxField
          label="4. 개인정보 수집/처리"
          checked={value.personalData.processes}
          onChange={(processes) => patchPersonal({ processes })}
        />
        <CheckboxField
          label="↳ 민감정보 포함 (건강·생체·사상)"
          checked={value.personalData.sensitive}
          onChange={(sensitive) => patchPersonal({ sensitive })}
          subtle
        />
        <TristateField
          label="5. 개인정보 국외이전"
          hint="외국 모델 API 호출도 국외이전에 해당할 수 있음. 모르면 비워두기 (코드 스캔으로 자동 보강)"
          value={value.crossBorderTransfer}
          onChange={(crossBorderTransfer) => patch({ crossBorderTransfer })}
        />
      </Section>

      <Section
        no="③"
        title="자동화·고영향"
        hint="법상 의무 강도를 결정하는 핵심 변수"
      >
        <SegmentedField
          label="6. AI 결정 자동화 비중"
          options={AUTOMATION_OPTIONS}
          value={value.automationLevel}
          onChange={(v) => patch({ automationLevel: v })}
        />
        <MultiCheckField
          label="7. 고영향 분야 (해당 모두 선택)"
          hint="시행령 후보 영역. 하나라도 해당하면 영향평가 의무 발동 가능"
          options={HIGH_IMPACT_OPTIONS}
          values={value.highImpactDomains}
          onToggle={toggleHighImpact}
        />
        <SegmentedField
          label="8. 시행일(2026-01-22) 기준 상태"
          options={STATUS_OPTIONS}
          value={value.serviceStatus}
          onChange={(v) => patch({ serviceStatus: v })}
        />
      </Section>

      <Section
        no="④"
        title="조직 · 평가"
        hint="외국 사업자 대리인, 거버넌스 의무 판단 입력"
      >
        <NumberPairField
          label="9. 사업 규모 (작년 기준)"
          left={{
            label: "연매출 (원)",
            value: value.scale.annualRevenueKRW,
            onChange: (annualRevenueKRW) => patchScale({ annualRevenueKRW }),
            placeholder: "예: 50000000000",
          }}
          right={{
            label: "MAU (월간 활성 사용자)",
            value: value.scale.monthlyActiveUsers,
            onChange: (monthlyActiveUsers) =>
              patchScale({ monthlyActiveUsers }),
            placeholder: "예: 1500000",
          }}
        />
        <CheckboxRow
          label="10. 조직 거버넌스"
          items={[
            {
              label: "AI 책임자",
              checked: value.organization.hasAIOfficer,
              onChange: (hasAIOfficer) => patchOrg({ hasAIOfficer }),
            },
            {
              label: "DPO (개인정보 보호책임자)",
              checked: value.organization.hasDPO,
              onChange: (hasDPO) => patchOrg({ hasDPO }),
            },
            {
              label: "CISO (정보보호 최고책임자)",
              checked: value.organization.hasCISO,
              onChange: (hasCISO) => patchOrg({ hasCISO }),
            },
          ]}
        />
        <CheckboxRow
          label="11. 평가 수행 여부"
          items={[
            {
              label: "영향평가 완료",
              checked: value.assessments.impactDone,
              onChange: (impactDone) => patchAssess({ impactDone }),
            },
            {
              label: "위험평가 완료",
              checked: value.assessments.riskDone,
              onChange: (riskDone) => patchAssess({ riskDone }),
            },
          ]}
        />
      </Section>
    </fieldset>
  );
}

// ──────────────────────────────────────────────────────────
// 하위 building blocks
// ──────────────────────────────────────────────────────────

function Section({
  no,
  title,
  hint,
  children,
}: {
  no: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="px-5 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold tracking-wider text-slate-400">
            {no}
          </span>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
        {hint ? (
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        ) : null}
      </header>
      <div className="px-5 py-4 space-y-5">{children}</div>
    </section>
  );
}

function FieldLabel({
  label,
  hint,
  htmlFor,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-0.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-800"
      >
        {label}
      </label>
      {hint ? (
        <p className="text-xs text-slate-500 leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
}

function SegmentedField<T extends string>({
  label,
  options,
  value,
  onChange,
  hint,
}: {
  label: string;
  options: Array<{ value: T; label: string; hint?: string }>;
  value: T;
  onChange: (v: T) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <FieldLabel label={label} hint={hint} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`text-left px-3 py-2 rounded-md border text-sm transition ${
                active
                  ? "border-blue-600 bg-blue-50 text-blue-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="font-medium">{opt.label}</div>
              {opt.hint ? (
                <div className="text-xs text-slate-500 mt-0.5">{opt.hint}</div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
  subtle,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  subtle?: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-2.5 cursor-pointer select-none ${
        subtle ? "pl-4" : ""
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-sm text-slate-800">{label}</span>
    </label>
  );
}

function TristateField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const opts: Array<{ v: boolean | null; label: string }> = [
    { v: true, label: "있음" },
    { v: false, label: "없음" },
    { v: null, label: "모름 (자동 추정)" },
  ];
  return (
    <div className="space-y-2">
      <FieldLabel label={label} hint={hint} />
      <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
        {opts.map((o, i) => {
          const active = value === o.v;
          return (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => onChange(o.v)}
              className={`px-3 py-1.5 text-sm transition ${
                active
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-50"
              } ${i > 0 ? "border-l border-slate-200" : ""}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MultiCheckField<T extends string>({
  label,
  hint,
  options,
  values,
  onToggle,
}: {
  label: string;
  hint?: string;
  options: Array<{ value: T; label: string }>;
  values: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <FieldLabel label={label} hint={hint} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {options.map((opt) => {
          const active = values.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              className={`px-3 py-1.5 rounded-md border text-sm transition ${
                active
                  ? "border-blue-600 bg-blue-50 text-blue-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NumberPairField({
  label,
  left,
  right,
}: {
  label: string;
  left: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    placeholder?: string;
  };
  right: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    placeholder?: string;
  };
}) {
  return (
    <div className="space-y-2">
      <FieldLabel label={label} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[left, right].map((f, i) => (
          <label key={i} className="block">
            <span className="block text-xs text-slate-500 mb-1">{f.label}</span>
            <input
              type="number"
              min={0}
              value={Number.isFinite(f.value) ? f.value : 0}
              placeholder={f.placeholder}
              onChange={(e) => {
                const n = Number(e.target.value);
                f.onChange(Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
              }}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function CheckboxRow({
  label,
  items,
}: {
  label: string;
  items: Array<{
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }>;
}) {
  return (
    <div className="space-y-2">
      <FieldLabel label={label} />
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {items.map((it, i) => (
          <CheckboxField
            key={i}
            label={it.label}
            checked={it.checked}
            onChange={it.onChange}
          />
        ))}
      </div>
    </div>
  );
}
