---
id: model-procurement
title: Model and Vendor Procurement
status: draft
version: 0.3.0
updated: 2026-09-22
owner: adi@adidacta.com
domain: procurement
tags: [procurement, vendors, security]
depends_on: [ai-governance-charter, data-handling]
relates_to: [acceptable-use]
supersedes: []
references:
  - EU AI Act (Regulation 2024/1689), Art. 25 obligations along the value chain
---

## Purpose

Decide which models and AI vendors the organisation is willing to depend on,
before a dependency exists rather than after.

## Scope

Any paid or free AI model, API, or AI-enabled SaaS product used for work.

## Policy

1. A vendor is assessed against the controls in [[data-handling]] before first
   use, not before renewal.
2. Assessments record: data residency, training-on-customer-data stance,
   subprocessors, incident history, and model deprecation policy.
3. Every production dependency names a fallback — a second provider or a
   degraded non-AI path — proportionate to the system's risk tier.
4. Deprecation notice periods are a selection criterion. A vendor that can
   retire a model with less than 90 days' notice is a higher-risk dependency and
   must be recorded as such.
5. Free tiers are procurement decisions too, and follow the same path.

## Exceptions

Short evaluations on public data need no assessment, provided nothing
confidential is submitted and the trial does not auto-convert to production.

## Review

Reviewed annually once this policy reaches `active`.
