import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { InfoPage } from "@/components/InfoPage";

export default async function SupportPage() {
  const t = await getTranslations("Support");
  const email = t("email");

  return (
    <InfoPage namespace="Support" values={{ email }}>
      <div className="flex gap-2.5">
        <a
          href={`mailto:${email}`}
          className="flex-1 rounded-full bg-ice py-2.5 text-center font-display text-[13px] font-bold text-[#062024]"
        >
          {email}
        </a>
        <Link
          href="/regles"
          className="flex-1 rounded-full border border-border bg-card py-2.5 text-center font-display text-[13px] font-bold text-frost"
        >
          {t("rulesLink")}
        </Link>
      </div>
    </InfoPage>
  );
}
