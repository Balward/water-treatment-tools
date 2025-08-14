# Deployment Process for New Applications

This document outlines the standard process for adding new applications to the Water Treatment Tools suite.

## Required Steps for Each New Application

### 1. Application Development
- [ ] Create new package directory: `packages/[app-name]/`
- [ ] Implement core files: `index.html`, `script.js`, `styles.css`
- [ ] Follow existing design patterns and styling conventions
- [ ] Test application functionality locally

### 2. Dashboard Integration
- [ ] Add new app card to `packages/dashboard/dashboard.html`
- [ ] Include app icon, description, and feature tags
- [ ] Use relative link: `../[app-name]/index.html`
- [ ] Test dashboard navigation

### 3. Docker Configuration Updates
- [ ] Add nginx routes to `nginx.conf`:
  ```nginx
  # [App Name] routes
  location /[app-name]/ {
      alias /usr/share/nginx/html/packages/[app-name]/;
      try_files $uri $uri/ /packages/[app-name]/index.html;
      
      location ~* \.(js|css|html)$ {
          expires 1h;
          add_header Cache-Control "public, immutable";
      }
  }
  ```
- [ ] Test Docker build process (if Docker is available)
- [ ] Verify routing configuration

### 4. Git Workflow
- [ ] Stage all new files: `git add packages/[app-name]/`
- [ ] Stage dashboard changes: `git add packages/dashboard/dashboard.html`
- [ ] Stage nginx config: `git add nginx.conf`
- [ ] Create comprehensive commit message with feature list
- [ ] Push to GitHub: `git push`

### 5. Documentation Updates
- [ ] Update README.md if needed
- [ ] Add any special deployment notes
- [ ] Document new features or functionality

## Standard Commit Message Template

```
Add [App Name] with [key features]

Features:
- [Feature 1]
- [Feature 2]
- [Feature 3]
- Dashboard integration
- Docker/nginx routing support

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## File Structure Checklist

Each new application should follow this structure:
```
packages/[app-name]/
├── index.html          # Main application interface
├── script.js           # Application logic
└── styles.css          # Application styling
```

## Quality Standards

### Code Quality
- [ ] Consistent styling with existing apps
- [ ] Responsive design (mobile-first)
- [ ] Error handling and user feedback
- [ ] Local storage for persistence (if applicable)
- [ ] Keyboard navigation support

### Performance
- [ ] Optimized asset loading
- [ ] Proper caching headers in nginx
- [ ] Minimal external dependencies
- [ ] Fast initial load time

### Security
- [ ] No hardcoded sensitive data
- [ ] Proper input validation
- [ ] CSRF protection considerations
- [ ] Content Security Policy compliance

## Testing Checklist

### Local Testing
- [ ] Application works in isolation
- [ ] Dashboard navigation functions
- [ ] Responsive design on multiple screen sizes
- [ ] Cross-browser compatibility

### Docker Testing (if available)
- [ ] Docker build succeeds
- [ ] Nginx routing works correctly
- [ ] Static assets load properly
- [ ] Application accessible via container

### Production Readiness
- [ ] All links use relative paths
- [ ] No console errors
- [ ] Proper fallback handling
- [ ] Health check compatibility

## Deployment Commands

Standard command sequence for new app deployment:

```bash
# Stage all changes
git add packages/[app-name]/
git add packages/dashboard/dashboard.html
git add nginx.conf

# Commit with standard message
git commit -m "Add [App Name] with [features]

Features:
- [Feature list]
- Dashboard integration  
- Docker/nginx routing support

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to repository
git push
```

## Rollback Process

If issues are discovered after deployment:

1. **Immediate**: Remove app card from dashboard
2. **Quick Fix**: Update nginx.conf to return 404 for app routes
3. **Full Rollback**: `git revert [commit-hash]` and push

## Notes

- Always test locally before committing
- Ensure Docker configuration is updated for production deployment
- Follow existing naming conventions for consistency
- Document any special requirements or dependencies
- Consider backward compatibility when making changes

---

**This process ensures consistent, reliable deployment of new applications to the Water Treatment Tools suite.**