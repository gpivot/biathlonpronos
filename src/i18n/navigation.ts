import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Link / redirect / usePathname / useRouter conscients de la locale — à
 * utiliser à la place des équivalents next/navigation partout dans l'app.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
