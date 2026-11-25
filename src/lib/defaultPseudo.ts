// Pseudo « d'origine » : celui que la base attribue à la création du compte quand le joueur n'en a pas
// saisi (migrations 0004 et 0031) = la partie avant le @ de l'e-mail, ou « Invité ». C'est le cas des
// connexions Apple/Google : avec « Masquer mon e-mail », Apple donne un e-mail relais du type
// x7k2qp9mzd@privaterelay.appleid.com, d'où un pseudo fait de lettres et de chiffres.
// Sert à inviter le joueur, sur l'accueil, à se choisir un vrai nom pour le classement.
export function isDefaultPseudo(pseudo: string | null | undefined, email: string | null | undefined): boolean {
  const value = (pseudo ?? "").trim().toLowerCase();
  if (!value || value === "invité") return true;
  const localPart = (email ?? "").split("@")[0]?.trim().toLowerCase();
  return Boolean(localPart) && value === localPart;
}
