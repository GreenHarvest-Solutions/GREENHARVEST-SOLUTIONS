# AI Feature Catalogue — GreenHarvest

Constraints:

- Python
- No LLM
- No external AI API
- Vercel Hobby
- Supabase free
- Tesseract OCR is allowed

Legend: **P0** = build first, **P1** = next, **P2** = later.
Method: **ML** = trained model, **CV** = computer vision, **NLP** = classical text, **OPT** = optimization, **RULE** = deterministic smart logic.

---

## 1. Farmer and Advisor

| # | Feature | What it does | Method | Data | Priority |
|---|---|---|---|---|---|
| 1 | Demand forecast | 7/30/90-day demand per product or category | `statsforecast`, XGBoost | Orders, price history, seasonality | P0 |
| 2 | Stockout prediction | "You will run out in X days"; reorder quantity | Sales velocity + safety stock | Inventory, order items | P0 |
| 3 | Price positioning | Compare price to corridor, category, region; recommend min/target/max | Quantiles, regression | Products, `commodity_price_history`, `price_corridors` | P0 |
| 4 | Revenue anomaly detection | Flag unusual revenue drops/spikes and explain by product/region | STL decomposition, IsolationForest | Orders, order items | P0 |
| 5 | Review aspect sentiment | Which aspects drive ratings: freshness, packaging, delivery | TF-IDF + classifier | Reviews | P1 |
| 6 | Campaign response prediction | Predict redemption/ROI; suggest audience and discount depth | XGBoost, RFM segmentation | Campaigns, orders | P1 |
| 7 | Listing quality score | Completeness, image quality, category fit | Rules + OpenCV | Products, images | P1 |
| 8 | Farmer churn risk | Flag farmers likely to stop selling | Logistic regression/XGBoost | Users, orders, activity | P1 |
| 9 | Product image category suggestion | Suggest category from photo | Small CNN/ONNX | Product images | P2 |
| 10 | Crop disease triage | Photo-based disease risk | CNN | Labeled crop images | P2 — not now |

---

## 2. Buyer and Marketplace

| # | Feature | What it does | Method | Data | Priority |
|---|---|---|---|---|---|
| 11 | Personalized recommendations | Rank products for each buyer | `implicit` ALS + content similarity | Orders, reviews | P0 |
| 12 | Similar products/substitutes | "More like this"; alternatives when out of stock | TF-IDF cosine similarity | Product descriptions | P0 |
| 13 | Search ranking and typo correction | Better ordering, spelling correction, synonyms | PostgreSQL FTS + `pg_trgm` + SymSpell | Products, search logs | P0 |
| 14 | Basket completion | "Frequently bought together" | FP-Growth / association rules | Order items | P1 |
| 15 | Reorder prediction | Remind buyers when they likely need more | Classification/survival model | Order history | P1 |
| 16 | Price drop/deal score | Alert when price is below forecast or corridor | Time series + rules | Price history | P2 |
| 17 | Review helpfulness ranking | Surface useful reviews first | Gradient boosting | Reviews, votes | P2 |

---

## 3. Logistics and Cold Chain

| # | Feature | What it does | Method | Data | Priority |
|---|---|---|---|---|---|
| 18 | ETA prediction | Predicted arrival time with confidence range | XGBoost/LightGBM; rules fallback | `deliveries`, `fleet_shipments` | P0 |
| 19 | Cold-chain breach risk | Risk score before temperature breach | IsolationForest, statistical control | `fleet_shipment_events` | P1 |
| 20 | Spoilage risk score | Cargo-specific risk from temperature exposure and duration | Rules + ML | Telemetry, cargo type | P1 |
| 21 | Carrier performance score | Rank carriers by on-time, breach rate, cost | Weighted scoring | Fleet, deliveries | P1 |
| 22 | Dispatch/route optimization | Assign batches and reroute trucks | Google OR-Tools | Hubs, distances, capacity | P2 |
| 23 | Hub demand allocation | Move stock to hubs based on forecast | Forecast + optimization | Orders, inventory, hubs | P2 |
| 24 | Proof-of-delivery OCR | Extract delivery notes; flag damage | Tesseract + OpenCV | Delivery photos | P2 |

---

## 4. Admin: KYC, Moderation, Commerce, Risk

| # | Feature | What it does | Method | Data | Priority |
|---|---|---|---|---|---|
| 25 | KYC OCR | Extract name, ID number, region, expiry from documents | Tesseract `amh+eng` + regex | `kyc_documents` | P0 |
| 26 | KYC risk score and queue priority | Rank dossiers by risk; explain top factors | Rules + XGBoost/SHAP | KYC docs, profile, field visits | P0 |
| 27 | KYC duplicate identity detection | Same person/phone/address across accounts | RapidFuzz + graph features | Users, documents | P1 |
| 28 | Product moderation risk score | Flag prohibited, misleading, duplicate, low-quality listings | TF-IDF + OpenCV/ONNX | Products, images, moderation actions | P0 |
| 29 | Duplicate listing detection | Same product or image posted twice | Perceptual hash + TF-IDF | Products, images | P1 |
| 30 | Price outlier detection | Detect dumping/gouging vs corridor | Statistical deviation | `price_corridors`, products | P0 |
| 31 | Fake review/spam detection | Spam probability and reason codes | TF-IDF + LogisticRegression/SVM | Reviews, moderation labels | P0 |
| 32 | Review sentiment/toxicity | Aspect sentiment and toxic language | Text classifier | Reviews | P1 |
| 33 | Dispute triage | Classify claim; recommend refund/partial/reject | Rules + similar-case retrieval | Returns, escrow, audit logs | P1 |
| 34 | Dispute evidence summary | Extractive timeline and key facts | TextRank/LexRank | Notes, documents | P1 |
| 35 | Escrow/payout anomaly | Flag unusual releases, holds, or splits | IsolationForest + rules | `escrow_ledger` | P2 |
| 36 | Fraud/multi-account detection | Linked accounts, collusion, promo abuse | Graph features + XGBoost | Users, orders, payments | P2 |
| 37 | Support ticket classification | Category, priority, suggested queue | TF-IDF + classifier | Support tickets | P1 — when support module exists |
| 38 | SLA breach prediction | Prioritize tickets/dossiers likely to breach | Survival/classification | Audit logs, queue timestamps | P2 |
| 39 | Audit log anomaly detection | Unusual admin actions or access patterns | Sequence rules + IsolationForest | `audit_logs` | P2 |
| 40 | Field visit prioritization | Order visits by risk and location | Risk score + routing | `field_visits`, `agent_farmers` | P2 |

---

## 5. Platform Intelligence

| # | Feature | What it does | Method | Data | Priority |
|---|---|---|---|---|---|
| 41 | Churn prediction | Flag farmers/buyers at risk of leaving | XGBoost/logistic regression | Users, orders, activity | P1 |
| 42 | Farmer success score | Composite health score for every farmer | Weighted model | Orders, reviews, listings, fulfillment | P1 |
| 43 | Regional demand anomaly | Flag unusual demand by region/commodity | STL/IsolationForest | Commodity price history | P1 |
| 44 | Notification send-time optimization | Send when each user is most likely to engage | Logistic regression/bandit | Notifications, events | P2 |
| 45 | Search query insights | Detect zero-result and low-conversion queries | Clustering + rules | Search logs | P2 |

---

## Recommended MVP — build these first

These are the highest value with existing data and no LLM:

1. Demand forecast
2. Stockout prediction
3. Price positioning
4. Revenue anomaly detection
5. Personalized recommendations
6. Similar products
7. Search ranking + typo correction
8. ETA prediction
9. KYC OCR
10. KYC risk scoring
11. Product moderation risk scoring
12. Price outlier detection
13. Fake review/spam detection
14. Cold-chain rule-based breach alerts

Everything except KYC OCR can run as a fast HTTP call or a nightly batch. OCR runs as an async job in the Python container.

---

## Data prerequisites

Some features are ready now; others need instrumentation first.

**Ready now:**

- Orders, order items, inventory, products, reviews.
- Commodity price history.
- KYC documents and field visits.
- Price corridors.
- Escrow ledger and disputes.
- Fleet telemetry snapshots.

**Needed for P1/P2:**

- `fleet_shipment_events` for real cold-chain anomaly detection.
- Product views, searches, add-to-cart events for better recommendations.
- Search query logs for ranking and typo correction.
- Admin moderation decisions as labels for fake-review and moderation models.
- A product-to-commodity mapping table for reliable forecasting.
- Support ticket tables before ticket classification.

---

## What not to build now

- Crop disease diagnosis — needs labeled images and agronomist validation.
- Yield prediction — needs farm, weather, and planting data you do not have.
- Generative chat or AI-written descriptions — that requires an LLM.
- Autonomous KYC approval, dispute resolution, or payout release — keep a human decision.
- PyTorch/PaddleOCR/EasyOCR on Vercel — too heavy for the free tier.
- Custom deep learning from scratch — not enough data.

---

## Suggested build order

**Sprint 1 — Farmer intelligence**

- Demand forecast
- Stockout prediction
- Price positioning
- Revenue anomaly detection

**Sprint 2 — Buyer intelligence**

- Recommendations
- Similar products
- Search ranking
- Fake review detection

**Sprint 3 — Admin intelligence**

- KYC OCR
- KYC risk scoring
- Product moderation risk
- Price outlier detection

**Sprint 4 — Logistics**

- ETA prediction
- Cold-chain rule alerts
- Carrier scoring

This gives you a credible AI product without any LLM, external API, or paid AI service.
