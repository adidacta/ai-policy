---
id: ai-governance-charter
title: AI Governance Charter
status: active
version: 1.0.0
updated: 2026-09-22
owner: adi@adidacta.com
domain: governance
tags: [governance, accountability]
depends_on: []
relates_to: []
supersedes: []
references:
  - EU AI Act (Regulation 2024/1689)
  - NIST AI Risk Management Framework 1.0
---

## Purpose

This charter is the root of the policy set. It establishes who decides how AI is
built and used here, what risk appetite those decisions must respect, and how
every other policy in this repository derives its authority.

## Scope

All AI systems the organisation builds, buys, or embeds — including third-party
models accessed through an API, models fine-tuned on internal data, and AI
features shipped inside vendor products.

## Policy

1. An accountable owner is named for every AI system in production. Ownership is
   a person, never a team alias.
2. Every system is classified by risk tier before first production use. The tier
   determines which controls in the dependent policies apply.
3. No AI system may make a final decision affecting a person's employment,
   credit, housing, or legal standing without a documented human reviewer who
   has the authority and the information to overturn it.
4. Policies in this repository take effect when their status is `active`. A
   policy in `draft` or `review` is not binding.

## Exceptions

Exceptions to this charter are granted only by the accountable executive, in
writing, with an expiry date no more than 90 days out.

## Review

Reviewed annually, or within 30 days of a material change in applicable
regulation.
