# UI/UX Pro Max: interface review

Use this workflow for a page or component's design, accessibility and interaction review.

## Usage

```
/ui-ux-pro-max-review describe the interface, audience and implementation stack
```

## Workflow

1. Identify the product, audience, screen sizes and actual stack from project files. Read any existing design system before proposing replacements.
2. Prioritize accessibility: readable contrast, keyboard access, visible focus, useful labels and accessible names for icon-only controls.
3. Review touch and interaction: usable hit areas, spacing, loading feedback and clear success/error states. Do not rely on hover alone.
4. Check responsive layout, text wrapping, overflow, spacing and consistent SVG icons. Avoid emoji icons and false status indicators.
5. Use consistent typography and semantic colors. Respect reduced-motion settings; reserve space for loading content.
6. Inspect real screenshots at desktop and mobile widths. For each issue, report the affected element, observed problem and specific fix. Do not claim a visual result is verified without seeing it.

## Devora limits

Adapted from UI/UX Pro Max's prioritized review workflow. This is a Markdown prompt, not the full upstream Python search engine, style datasets, CLI or design-system generator. None of those is installed by this file. Devora has no screenshot tool in its shell-free executor; request screenshots or an operator's visual check before a readiness claim.

## Source and license

This Devora-format adaptation is based on https://github.com/nextlevelbuilder/ui-ux-pro-max-skill at commit `7246805992a42b7bba37d4cac83b01416f0c6c44`. The upstream MIT notice is retained below.

```text
MIT License

Copyright (c) 2024 Next Level Builder

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
