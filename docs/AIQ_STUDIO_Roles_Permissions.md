# AIQ STUDIO MVP — Roles & Permissions v0.1

## 1. Roles

### Registered User

کاربری که account دارد اما هنوز به برند فعال متصل نیست.

Can:
```text
- Login
- View inactive Dashboard
- Enter Access Key
- Request demo access
```

Cannot:
```text
- View brand data
- Answer intake
- View modules
- Run agents
```

---

### Brand Owner / Executive Manager

تصمیم‌گیرنده اصلی برند. در MVP این دو role permission یکسان دارند.

Can:
```text
- View active Dashboard
- Create/claim brand with valid Access Key
- Answer Strategic Brand Intake
- Edit answers before Final Submit
- Final Submit intake
- Invite Brand Specialist
- Approve/reject Specialist uploads
- View client review modules
- Comment on modules
- Approve module or request change
- Submit Change Request for locked intake sections
- Activate available agents
- Run active agents
```

Cannot:
```text
- Directly edit locked answers
- Approve file for RAG
- Change system prompts
- See internal-only files
- Grant plan manually
```

---

### Brand Specialist

کارشناس برند از سمت مشتری که توسط Owner یا Admin دعوت می‌شود.

Can:
```text
- Join brand via time-limited email-bound invitation
- Upload supporting files
- Download files allowed for brand team
- Comment on allowed modules/files
```

Cannot:
```text
- Final Submit intake
- Approve modules
- Request final RAG approval
- Invite users
- See billing/plan details
- Activate agents
```

---

### Internal Specialist

عضو تیم داخلی AIQ STUDIO/Helio که روی moduleها کار می‌کند.

Can:
```text
- View assigned brands/modules
- Upload internal draft DOCX/PDF
- Add internal comments
- Submit work for Supervisor review
```

Cannot:
```text
- Send module directly to client
- Approve module for RAG
- Grant access or plan
- Approve client-side output
```

---

### Supervisor

مدیر داخلی فرآیند استراتژی/تحویل.

Can:
```text
- View assigned/all brand modules depending on internal policy
- Review Internal Specialist outputs
- Approve module for client review
- Review client change requests
- Approve/recommend RAG readiness
- Trigger RAG sync if Platform Owner policy allows
```

Cannot:
```text
- Grant paid plan unless explicitly Platform Owner
- Silently approve on behalf of client
- Bypass audit log
```

---

### Platform Owner

مالک پلتفرم / شما.

Can:
```text
- Full admin access
- Create brand
- Create and send Access Key
- Grant manual plan entitlement
- Manage users and roles
- Manage plans
- Approve RAG readiness
- Trigger RAG sync
- Activate/suspend agents
- View audit logs
```

Must:
```text
- Be audited for every sensitive action
```

## 2. Permission Matrix

| Action | Registered User | Owner/Executive | Brand Specialist | Internal Specialist | Supervisor | Platform Owner |
|---|---:|---:|---:|---:|---:|---:|
| Login | Yes | Yes | Yes | Yes | Yes | Yes |
| View inactive Dashboard | Yes | Yes | Yes | No | No | Yes |
| Redeem CREATE_BRAND key | Yes | Yes | No | No | No | Yes |
| Create brand | With key | With key | No | No | No | Yes |
| Claim brand | With key | With key | No | No | No | Yes |
| Answer intake | No | Yes | No | No | No | Override only |
| Final submit intake | No | Yes | No | No | No | Override only |
| Create change request | No | Yes | Comment only | No | Yes | Yes |
| Invite Specialist | No | Yes | No | No | Yes | Yes |
| Upload file | No | Yes | Yes | Yes | Yes | Yes |
| Download allowed file | No | Yes | Yes | Yes | Yes | Yes |
| Approve Specialist upload | No | Yes | No | No | Yes | Yes |
| Upload module draft | No | No | No | Yes | Yes | Yes |
| Send module to client review | No | No | No | No | Yes | Yes |
| Client approve module | No | Yes | No | No | No | Emergency override only |
| RAG approve | No | No | No | No | Yes | Yes |
| Trigger RAG sync | No | No | No | No | Limited | Yes |
| Activate agent | No | Yes | No | No | No | Yes |
| Run agent | No | Yes | No/limited | No | Internal test only | Yes |
| Manual plan grant | No | No | No | No | No | Yes |
| View audit logs | No | No | No | No | Limited | Yes |

## 3. Important Permission Functions

```ts
canViewDashboard(userId: string): Promise<boolean>
canRedeemAccessKey(userId: string, key: string): Promise<boolean>
canCreateBrand(userId: string, accessKeyId: string): Promise<boolean>
canClaimBrand(userId: string, brandId: string, accessKeyId: string): Promise<boolean>
canAnswerIntake(userId: string, brandId: string): Promise<boolean>
canFinalSubmitIntake(userId: string, brandId: string): Promise<boolean>
canCreateChangeRequest(userId: string, brandId: string): Promise<boolean>
canInviteBrandMember(userId: string, brandId: string): Promise<boolean>
canUploadBrandFile(userId: string, brandId: string): Promise<boolean>
canApproveSpecialistFile(userId: string, brandId: string): Promise<boolean>
canSendModuleToClient(userId: string, moduleId: string): Promise<boolean>
canClientApproveModule(userId: string, moduleId: string): Promise<boolean>
canApproveRag(userId: string, moduleId: string): Promise<boolean>
canSyncRag(userId: string, brandId: string): Promise<boolean>
canActivateAgent(userId: string, brandId: string, agentKey: string): Promise<boolean>
canRunAgent(userId: string, brandId: string, agentKey: string): Promise<boolean>
```
