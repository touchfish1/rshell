# UI Component Reference

Complete reference for 60 UI components with best practices, common layouts, and aliases.
Sourced from [component.gallery](https://component.gallery) and enriched with production-grade guidance.

---

## Contents

- [Accordion](#accordion)
- [Alert](#alert)
- [Avatar](#avatar)
- [Badge](#badge)
- [Breadcrumbs](#breadcrumbs)
- [Button](#button)
- [Button group](#button-group)
- [Card](#card)
- [Carousel](#carousel)
- [Checkbox](#checkbox)
- [Color picker](#color-picker)
- [Combobox](#combobox)
- [Date input](#date-input)
- [Datepicker](#datepicker)
- [Drawer](#drawer)
- [Dropdown menu](#dropdown-menu)
- [Empty state](#empty-state)
- [Fieldset](#fieldset)
- [File](#file)
- [File upload](#file-upload)
- [Footer](#footer)
- [Form](#form)
- [Header](#header)
- [Heading](#heading)
- [Hero](#hero)
- [Icon](#icon)
- [Image](#image)
- [Label](#label)
- [Link](#link)
- [List](#list)
- [Modal](#modal)
- [Navigation](#navigation)
- [Pagination](#pagination)
- [Popover](#popover)
- [Progress bar](#progress-bar)
- [Progress indicator](#progress-indicator)
- [Quote](#quote)
- [Radio button](#radio-button)
- [Rating](#rating)
- [Rich text editor](#rich-text-editor)
- [Search input](#search-input)
- [Segmented control](#segmented-control)
- [Select](#select)
- [Separator](#separator)
- [Skeleton](#skeleton)
- [Skip link](#skip-link)
- [Slider](#slider)
- [Spinner](#spinner)
- [Stack](#stack)
- [Stepper](#stepper)
- [Table](#table)
- [Tabs](#tabs)
- [Text input](#text-input)
- [Textarea](#textarea)
- [Toast](#toast)
- [Toggle](#toggle)
- [Tooltip](#tooltip)
- [Tree view](#tree-view)
- [Video](#video)
- [Visually hidden](#visually-hidden)

---

## Accordion

**Also known as:** Arrow toggle · Collapse · Collapsible sections · Collapsible · Details · Disclosure · Expandable · Expander

A vertically stacked set of collapsible sections — each heading toggles between showing a short label and revealing the full content beneath it.

**Best practices:**
- Use for long-form content that benefits from progressive disclosure
- Keep headings concise and scannable — they are the primary navigation
- Allow multiple sections open simultaneously unless space is critically limited
- Include a subtle expand/collapse icon (chevron) aligned consistently on the right
- Animate open/close with a short ease-out transition (150–250 ms)
- Ensure keyboard navigation: Enter/Space toggles, arrow keys move between headers

**Common layouts:**
- FAQ page with stacked question/answer pairs
- Settings panel with grouped preference sections
- Sidebar filter groups in e-commerce or dashboards
- Mobile navigation with expandable menu sections

---

## Alert

**Also known as:** Notification · Feedback · Message · Banner · Callout

A prominent message used to communicate important information or status changes to the user.

**Best practices:**
- Use semantic color coding: red for errors, amber for warnings, green for success, blue for info
- Include a clear, actionable message — not just a status label
- Provide a dismiss action for non-critical alerts
- Position inline alerts close to the relevant content, not floating arbitrarily
- Use an icon alongside color to ensure accessibility for color-blind users
- Keep alert text to one or two sentences maximum

**Common layouts:**
- Top-of-page banner for system-wide announcements
- Inline form validation message beneath an input field
- Toast notification stack in the bottom-right corner
- Contextual warning inside a card or settings section

---

## Avatar

A visual representation of a user, typically displayed as a photo, illustration, or initials.

**Best practices:**
- Support three sizes: small (24–32 px), medium (40–48 px), large (64–80 px)
- Fall back gracefully: image → initials → generic icon
- Use a subtle ring or border to separate the avatar from its background
- For groups, stack avatars with a slight overlap and a '+N' overflow indicator
- Ensure the image is loaded lazily with a placeholder shimmer

**Common layouts:**
- User profile header with name and role
- Comment thread with avatar beside each message
- Team member list with stacked avatar group
- Navigation bar user menu trigger

---

## Badge

**Also known as:** Tag · Label · Chip

A compact label that sits within or near a larger component to convey status, category, or other metadata.

**Best practices:**
- Keep badge text to one or two words — they are labels, not sentences
- Use a limited palette of badge colors mapped to clear semantics
- Ensure sufficient contrast between badge text and background (WCAG AA minimum)
- Use pill shape (fully rounded corners) for status badges, rounded rectangles for tags
- Avoid overusing badges — if everything is badged, nothing stands out

---

## Card

**Also known as:** Tile

A self-contained content block representing a single entity such as a contact, article, or task.

**Best practices:**
- Use a single, clear visual hierarchy within each card: media → title → meta → action
- Keep cards a consistent height in grid layouts — use line clamping for variable text
- Make the entire card clickable when it represents a navigable entity
- Use subtle elevation (shadow) or a border — not both simultaneously
- Limit card content to essential info; let the detail page carry the rest

---

## Empty state

A placeholder shown when a view has no data to display, typically paired with a helpful action or suggestion.

**Best practices:**
- Include a clear illustration or icon to soften the empty feeling
- Write a helpful headline explaining the empty state
- Provide a primary CTA that guides the user toward the next step
- Avoid blame — frame it positively ('No projects yet' not 'You have no projects')
- Show the empty state in-place within the container, not as a full-page takeover

---

## Button

An interactive control that triggers an action — submitting a form, opening a dialog, toggling visibility.

**Best practices:**
- Establish a clear visual hierarchy: primary (filled), secondary (outlined), tertiary (text-only)
- Use verb-first labels: 'Save changes', 'Create project', not 'Okay' or 'Submit'
- Minimum touch target of 44×44 px; desktop buttons at least 36 px tall
- Show a loading spinner inside the button during async actions — disable to prevent double-clicks
- Limit to one primary button per visible viewport section
- Ensure focus ring is visible and high-contrast for keyboard users

---

_Note: full upstream reference omitted for brevity in this vendored copy._
