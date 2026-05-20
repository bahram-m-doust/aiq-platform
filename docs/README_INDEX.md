# Bextudio MVP Documentation Index

این فولدر، بسته‌ی عملیاتی ساخت MVP پلتفرم Bextudio است. چهار فایل اولیه برای فهم محصول و معماری کافی بودند، اما برای شروع Vibe Coding اصولی، فایل‌های ریزتر و اجرایی لازم است.

## فایل‌های اصلی قبلی

1. `Bextudio_Project_Overview.md`  
   توضیح کامل پروژه، جریان محصول، دامنه‌ها، نقش‌ها و منطق کلی.

2. `Bextudio_PRD.md`  
   Product Requirements Document شامل scope، featureها، acceptance criteria و MVP definition.

3. `Bextudio_Platform_Setup_Guide.md`  
   کارهایی که باید در Supabase، OpenAI، Stripe، Email، Storage و Server انجام شود.

4. `Bextudio_Technical_Data_Pack.md`  
   تایپ‌ها، statusها، permission functions، schema logic، prompt pack اولیه و تست‌های پایه.

## فایل‌های اجرایی اضافه‌شده برای شروع ساخت

5. `Bextudio_Vibe_Coding_Prompt_Pack.md`  
   پرامپت‌های آماده برای Cursor / AI Coding Tool، هماهنگ با Data Pack.

6. `Bextudio_Task_Breakdown.md`  
   breakdown کامل پروژه به Epic، Task، ترتیب ساخت، acceptance criteria و dependency.

7. `Bextudio_Folder_Structure.md`  
   ساختار اصولی فولدرها برای Next.js + Supabase، همراه با naming rules.

8. `Bextudio_Test_Plan.md`  
   تست پلن کامل شامل permission tests، workflow tests، security tests، RAG tests و manual QA.

9. `Bextudio_Security_Rules.md`  
   قوانین امنیتی و دسترسی، مخصوص محصول محرمانه‌ی برندها.

10. `Bextudio_Roles_Permissions.md`  
   ماتریس نقش‌ها و permissionها برای مشتری، Specialist، Supervisor و Platform Owner.

11. `Bextudio_Database_Schema.md`  
   schema پیشنهادی Supabase/Postgres با tableها، relationها، statusها و index suggestions.

## ترتیب پیشنهادی مطالعه

برای شروع پروژه:

```text
1. Project Overview
2. PRD
3. Roles & Permissions
4. Security Rules
5. Database Schema
6. Folder Structure
7. Task Breakdown
8. Prompt Pack
9. Platform Setup Guide
10. Test Plan
```

## قانون استفاده در Vibe Coding

قبل از هر prompt به AI Coding Tool، این context را بده:

```text
Use Bextudio_Project_Overview.md, Bextudio_PRD.md, Bextudio_Security_Rules.md, Bextudio_Roles_Permissions.md and Bextudio_Database_Schema.md as source of truth.
Build only the current task from Bextudio_Task_Breakdown.md.
Do not invent product logic.
Do not bypass permissions.
Do not expose files publicly.
```
