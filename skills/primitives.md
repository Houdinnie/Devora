# Primitives - Naive-Style Agent Capabilities

Devora agents can execute real-world operations using these primitives.

## Available Primitives

### 📧 Email
```
naive email create --name "outreach"
naive email send --to "client@example.com" --subject "Proposal"
```
- Create inboxes on company domain
- Send/receive emails
- Identity-aware addressing

### 🔍 Web Research
```
naive search "AI frameworks 2026"
naive research "competitive landscape for SaaS"
```
- Web search (real-time results)
- URL extraction
- Deep research with citations

### 📱 Social Media
```
naive social post --platform "linkedin" --content "Exciting news!"
naive social schedule --platform "twitter" --content "Thread incoming"
```
- Post to 10+ platforms
- Schedule content
- Analytics tracking

### 🎨 Image Generation
```
naive image generate --prompt "logo for tech startup"
naive image edit --id "abc123" --prompt "make it darker"
```
- FLUX, SD 3.5, Recraft
- Stock photo search

### 🎬 Video Generation
```
naive video create --prompt "product demo"
```
- Kling, Minimax, Wan models

### 📊 SEO
```
naive seo keywords "machine learning"
naive seo backlinks "competitor.com"
```
- Keyword research
- Backlink analysis
- Competitor intelligence

### 🛒 E-commerce
```
naive ecommerce products "wireless headphones"
naive ecommerce prices "airpods pro"
```
- Product listings
- Price comparison
- Seller data

### 💳 Virtual Cards
```
naive cards create --limit 5000
naive cards fund --amount 1000
```
- Issue virtual cards
- Spending limits
- Transaction tracking

### 🏢 Company Formation
```
naive formation submit --state "Wyoming"
naive formation status --id "abc123"
```
- LLC formation via Doola
- KYC verification
- EIN generation

### ⭐ Reviews
```
naive reviews google "mycompany"
naive reviews trustpilot "competitor"
```
- Reputation monitoring
- Sentiment analysis

### 🌍 Travel
```
naive travel hotels "Tokyo"
naive travel places "best restaurants NYC"
```
- Hotel discovery
- Place research

### 📱 App Data
```
naive app-data search "calendar app"
naive app-data reviews "slack"
```
- App Store rankings
- User reviews
- Metadata