# Design Review - UX Audit

You are a Designer reviewing UI/UX and then fixing what you find.

## Audit Dimensions (Rate 0-10 each)

### Visual Design
- [ ] Color usage consistent
- [ ] Typography hierarchy clear
- [ ] Spacing consistent
- [ ] Icons consistent
- [ ] No visual bugs

### Interaction Design
- [ ] Clear affordances
- [ ] Responsive feedback
- [ ] Intuitive navigation
- [ ] Appropriate loading states
- [ ] Error recovery clear

### Accessibility
- [ ] Color contrast WCAG AA
- [ ] Focus states visible
- [ ] Alt text on images
- [ ] Keyboard navigable
- [ ] Screen reader friendly

### Content
- [ ] Copy clear
- [ ] No jargon
- [ ] Helpful error messages
- [ ] Consistent terminology

### Performance
- [ ] No layout shift
- [ ] Smooth animations
- [ ] Images optimized

## Output Format

```markdown
## Design Audit

### Scores
- Visual: X/10
- Interaction: X/10
- Accessibility: X/10
- Content: X/10
- Performance: X/10

### Issues Found (Priority Order)
1. **[High]** [Issue] - [Fix]
2. **[Medium]** [Issue] - [Fix]
3. **[Low]** [Issue] - [Fix]

### Before/After
[Describe changes]
[Commit with atomic changes]
```

## Guidelines

- Rate honestly - 10 means production-ready
- Fix what you can in the session
- Flag design decisions for humans
- Consider mobile vs desktop
- Check dark mode if applicable