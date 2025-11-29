# Security Policy

## Known Vulnerabilities

### xlsx Package (Development Only)

**Status**: Known vulnerability, no fix available  
**Severity**: High  
**Affected**: Development scripts only (not in production build)

The `xlsx` package (version 0.18.5) has known vulnerabilities:
- [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) - Prototype Pollution
- [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) - Regular Expression Denial of Service (ReDoS)

**Risk Assessment**:
- ✅ **Low Risk**: The `xlsx` package is only used in `scripts/import-excel.ts`
- ✅ **Not in Production**: It's a `devDependency` and is NOT bundled in the production build
- ✅ **Admin Only**: The import script is only run manually by administrators
- ⚠️ **No Fix Available**: The maintainers have not released a patch yet

**Mitigation**:
- The package is only used for one-time data import operations
- It's not exposed to end users or included in the web application bundle
- Consider migrating to an alternative library (e.g., `exceljs`) if a fix is not released

**Action Items**:
- Monitor for updates to the `xlsx` package
- Consider alternative libraries if vulnerabilities persist
- Review and update this document when a fix becomes available

## Reporting Security Issues

If you discover a security vulnerability, please email [your-security-email] instead of using the issue tracker.

## Dependencies

We regularly update dependencies to address security vulnerabilities. Run `npm audit` to check for known issues.

For production deployments, only dependencies (not devDependencies) are included in the build, reducing the attack surface.

