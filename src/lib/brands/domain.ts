const BRAND_DOMAIN_PATTERN =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export function normalizeBrandDomain(input: string): string | null {
  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '');
  domain = domain.replace(/^www\./, '');
  domain = domain.split('/')[0];
  domain = domain.split('?')[0];
  domain = domain.split('#')[0];
  domain = domain.split(':')[0];

  if (
    domain.length === 0
    || domain.length > 253
    || !BRAND_DOMAIN_PATTERN.test(domain)
  ) {
    return null;
  }

  return domain;
}

export function isValidBrandDomainInput(input: string): boolean {
  return normalizeBrandDomain(input) !== null;
}
