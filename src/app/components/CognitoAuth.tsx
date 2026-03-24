import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Layers,
  Users,
  Shield,
  Lock,
  Globe,
  Zap,
  Key,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Smartphone,
  Mail,
} from "lucide-react";
import { DownloadCodeButton } from "./DownloadCodeButton";

type Tab =
  | "overview"
  | "user-pool"
  | "app-client"
  | "identity-pool"
  | "alb-auth"
  | "api-gw"
  | "lambda-auth"
  | "custom-domain"
  | "mfa-security"
  | "multi-env";

interface Section {
  title: string;
  description: string;
  code: string;
  tips?: string[];
  warnings?: string[];
}

const tabItems: {
  id: Tab;
  label: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { id: "overview", label: "全体像", icon: Layers, color: "bg-purple-600" },
  { id: "user-pool", label: "ユーザープール", icon: Users, color: "bg-blue-600" },
  { id: "app-client", label: "アプリクライアント", icon: Key, color: "bg-cyan-600" },
  { id: "identity-pool", label: "IDプール", icon: Shield, color: "bg-green-600" },
  { id: "alb-auth", label: "ALB + Cognito", icon: Globe, color: "bg-orange-500" },
  { id: "api-gw", label: "API Gateway連携", icon: Zap, color: "bg-amber-600" },
  { id: "lambda-auth", label: "Lambdaトリガー", icon: Zap, color: "bg-rose-600" },
  { id: "custom-domain", label: "カスタムドメイン", icon: Globe, color: "bg-indigo-600" },
  { id: "mfa-security", label: "MFA・セキュリティ", icon: Smartphone, color: "bg-red-600" },
  { id: "multi-env", label: "マルチ環境運用", icon: Layers, color: "bg-violet-600" },
];

// ─── ユーザープール ───
const userPoolSections: Section[] = [
  {
    title: "ユーザープール（基本構成）",
    description:
      "メールアドレスでのサインアップ、パスワードポリシー、アカウント復旧設定を含む本番向けユーザープールです。",
    code: `# ============================
# Cognito ユーザープール
# ============================
resource "aws_cognito_user_pool" "main" {
  name = "\${var.project}-\${var.environment}-users"

  # サインイン設定
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # ユーザー名の大文字小文字を区別しない
  username_configuration {
    case_sensitive = false
  }

  # パスワードポリシー
  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 3
  }

  # アカウント復旧
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # スキーマ属性（カスタム属性）
  schema {
    name                = "tenant_id"
    attribute_data_type = "String"
    mutable             = false

    string_attribute_constraints {
      min_length = 1
      max_length = 64
    }
  }

  schema {
    name                = "role"
    attribute_data_type = "String"
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 32
    }
  }

  # メール設定
  email_configuration {
    email_sending_account = "DEVELOPER"
    from_email_address    = "noreply@\${var.domain_name}"
    source_arn            = aws_ses_email_identity.noreply.arn
  }

  # 検証メッセージ
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "[\${var.project}] 確認コード"
    email_message        = "確認コード: {####}"
  }

  # 管理者によるユーザー作成設定
  admin_create_user_config {
    allow_admin_create_user_only = false

    invite_message_template {
      email_subject = "[\${var.project}] アカウント招待"
      email_message = "ユーザー名: {username}\\n一時パスワード: {####}"
      sms_message   = "ユーザー名: {username} パスワード: {####}"
    }
  }

  # デバイス追跡
  device_configuration {
    challenge_required_on_new_device      = true
    device_only_remembered_on_user_prompt = true
  }

  # ユーザープールのアドオン（高度なセキュリティ）
  user_pool_add_ons {
    advanced_security_mode = "ENFORCED"
  }

  tags = {
    Name        = "\${var.project}-user-pool"
    Environment = var.environment
  }
}

# SES メールアイデンティティ
resource "aws_ses_email_identity" "noreply" {
  email = "noreply@\${var.domain_name}"
}

# 変数定義
variable "project" {
  description = "プロジェクト名"
  type        = string
}

variable "environment" {
  description = "環境名"
  type        = string
  default     = "dev"
}

variable "domain_name" {
  description = "ドメイン名"
  type        = string
}`,
    tips: [
      "username_attributes = [\"email\"] でメールアドレスをユーザー名として使用",
      "auto_verified_attributes でメール自動検証を有効化",
      "advanced_security_mode = ENFORCED でリスクベース認証が有効に",
      "カスタム属性（tenant_id, role）はマルチテナント設計に有用",
      "パスワードは12文字以上・全種文字必須で強度を確保",
    ],
    warnings: [
      "カスタム属性は一度作成すると削除できない（mutable は変更可能）",
      "SES はサンドボックスモードでは検証済みアドレスにしか送信できない",
    ],
  },
  {
    title: "ユーザーグループ",
    description:
      "管理者・一般ユーザーなどのグループを定義し、IAMロールを紐付けます。グループごとにアクセス制御が可能です。",
    code: `# ============================
# ユーザーグループ: 管理者
# ============================
resource "aws_cognito_user_group" "admins" {
  name         = "admins"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "管理者グループ"
  precedence   = 1
  role_arn     = aws_iam_role.cognito_admin.arn
}

# ============================
# ユーザーグループ: 一般ユーザー
# ============================
resource "aws_cognito_user_group" "users" {
  name         = "users"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "一般ユーザーグループ"
  precedence   = 10
  role_arn     = aws_iam_role.cognito_user.arn
}

# ============================
# ユーザーグループ: 閲覧のみ
# ============================
resource "aws_cognito_user_group" "viewers" {
  name         = "viewers"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "閲覧専用グループ"
  precedence   = 20
  role_arn     = aws_iam_role.cognito_viewer.arn
}

# 管理者用 IAM ロール
resource "aws_iam_role" "cognito_admin" {
  name = "\${var.project}-cognito-admin"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })

  tags = {
    Name = "\${var.project}-cognito-admin"
  }
}

resource "aws_iam_role_policy" "cognito_admin" {
  name = "\${var.project}-admin-policy"
  role = aws_iam_role.cognito_admin.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:*",
          "dynamodb:*"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:RequestedRegion" = var.region
          }
        }
      }
    ]
  })
}

# 一般ユーザー用 IAM ロール
resource "aws_iam_role" "cognito_user" {
  name = "\${var.project}-cognito-user"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })

  tags = {
    Name = "\${var.project}-cognito-user"
  }
}

resource "aws_iam_role_policy" "cognito_user" {
  name = "\${var.project}-user-policy"
  role = aws_iam_role.cognito_user.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "\${var.app_bucket_arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query"
        ]
        Resource = var.app_table_arn
      }
    ]
  })
}

# 閲覧者用 IAM ロール
resource "aws_iam_role" "cognito_viewer" {
  name = "\${var.project}-cognito-viewer"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })

  tags = {
    Name = "\${var.project}-cognito-viewer"
  }
}

variable "region" {
  description = "AWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "app_bucket_arn" {
  description = "アプリケーションバケットARN"
  type        = string
}

variable "app_table_arn" {
  description = "アプリケーションDynamoDBテーブルARN"
  type        = string
}`,
    tips: [
      "precedence の値が小さいほど優先度が高い",
      "グループごとにIAMロールを紐付け、きめ細かいアクセス制御を実現",
      "Condition でリージョン制限をかけると安全性が向上",
    ],
  },
];

// ─── アプリクライアント ───
const appClientSections: Section[] = [
  {
    title: "アプリクライアント（SPA / モバイル用）",
    description:
      "フロントエンドアプリケーション用のクライアント設定です。PKCEフローを使用し、クライアントシークレットなしで安全に認証します。",
    code: `# ============================
# アプリクライアント（SPA用 - PKCE）
# ============================
resource "aws_cognito_user_pool_client" "spa" {
  name         = "\${var.project}-spa-client"
  user_pool_id = aws_cognito_user_pool.main.id

  # PKCE フロー（シークレットなし）
  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO"]

  # コールバック URL
  callback_urls = [
    "https://\${var.domain_name}/callback",
    "https://\${var.domain_name}/auth/callback"
  ]

  logout_urls = [
    "https://\${var.domain_name}/logout",
    "https://\${var.domain_name}"
  ]

  # トークン設定
  access_token_validity  = 1    # 時間
  id_token_validity      = 1    # 時間
  refresh_token_validity = 30   # 日

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # トークン取り消し有効化
  enable_token_revocation = true

  # サインアウト時にアクセストークン・IDトークンを失効
  prevent_user_existence_errors = "ENABLED"

  # 読み取り・書き込み属性
  read_attributes  = ["email", "name", "custom:tenant_id", "custom:role"]
  write_attributes = ["email", "name"]
}

# ============================
# アプリクライアント（サーバーサイド用）
# ============================
resource "aws_cognito_user_pool_client" "server" {
  name         = "\${var.project}-server-client"
  user_pool_id = aws_cognito_user_pool.main.id

  # クライアント認証フロー
  generate_secret                      = true
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["client_credentials"]
  allowed_oauth_scopes                 = ["\${aws_cognito_resource_server.api.identifier}/read", "\${aws_cognito_resource_server.api.identifier}/write"]
  supported_identity_providers         = ["COGNITO"]

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 1

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  enable_token_revocation       = true
  prevent_user_existence_errors = "ENABLED"
}

# ============================
# リソースサーバー（APIスコープ定義）
# ============================
resource "aws_cognito_resource_server" "api" {
  identifier   = "https://api.\${var.domain_name}"
  name         = "\${var.project}-api"
  user_pool_id = aws_cognito_user_pool.main.id

  scope {
    scope_name        = "read"
    scope_description = "読み取りアクセス"
  }

  scope {
    scope_name        = "write"
    scope_description = "書き込みアクセス"
  }

  scope {
    scope_name        = "admin"
    scope_description = "管理者アクセス"
  }
}`,
    tips: [
      "SPA/モバイルは generate_secret = false + PKCE フローが推奨",
      "サーバー間通信は client_credentials フロー + シークレット",
      "リソースサーバーでAPIスコープを定義し、きめ細かい認可を実現",
      "prevent_user_existence_errors でユーザー存在確認攻撃を防止",
    ],
    warnings: [
      "access_token_validity は短めに設定（1時間程度）",
      "開発環境ではcallback_urlsにlocalhost:3000も追加が必要",
    ],
  },
];

// ─── IDプール ───
const identityPoolSections: Section[] = [
  {
    title: "IDプール（認証済み・未認証アクセス）",
    description:
      "Cognito IDプールでAWS認証情報を一時的に取得し、S3やDynamoDBに直接アクセスする構成です。",
    code: `# ============================
# Cognito IDプール
# ============================
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "\${var.project}-\${var.environment}"
  allow_unauthenticated_identities = false
  allow_classic_flow               = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.spa.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = true
  }

  tags = {
    Name        = "\${var.project}-identity-pool"
    Environment = var.environment
  }
}

# ============================
# IDプール ロールマッピング
# ============================
resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id

  roles = {
    "authenticated"   = aws_iam_role.cognito_authenticated.arn
    "unauthenticated" = aws_iam_role.cognito_unauthenticated.arn
  }

  # グループベースのロールマッピング
  role_mapping {
    identity_provider         = "\${aws_cognito_user_pool.main.endpoint}:\${aws_cognito_user_pool_client.spa.id}"
    ambiguous_role_resolution = "AuthenticatedRole"
    type                      = "Token"
  }
}

# 認証済みユーザー用ロール
resource "aws_iam_role" "cognito_authenticated" {
  name = "\${var.project}-cognito-authenticated"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })

  tags = {
    Name = "\${var.project}-authenticated"
  }
}

# 認証済みユーザー: 自分のデータのみアクセス可能
resource "aws_iam_role_policy" "cognito_authenticated" {
  name = "\${var.project}-authenticated-policy"
  role = aws_iam_role.cognito_authenticated.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3UserFolder"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "\${var.app_bucket_arn}/users/\${!cognito-identity.amazonaws.com:sub}/*"
      },
      {
        Sid    = "DynamoDBUserItems"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query"
        ]
        Resource = var.app_table_arn
        Condition = {
          "ForAllValues:StringEquals" = {
            "dynamodb:LeadingKeys" = ["\${!cognito-identity.amazonaws.com:sub}"]
          }
        }
      }
    ]
  })
}

# 未認証ユーザー用ロール（最小権限）
resource "aws_iam_role" "cognito_unauthenticated" {
  name = "\${var.project}-cognito-unauthenticated"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "unauthenticated"
          }
        }
      }
    ]
  })

  tags = {
    Name = "\${var.project}-unauthenticated"
  }
}

resource "aws_iam_role_policy" "cognito_unauthenticated" {
  name = "\${var.project}-unauthenticated-policy"
  role = aws_iam_role.cognito_unauthenticated.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3PublicRead"
        Effect = "Allow"
        Action = ["s3:GetObject"]
        Resource = "\${var.app_bucket_arn}/public/*"
      }
    ]
  })
}`,
    tips: [
      "cognito-identity.amazonaws.com:sub でユーザー固有パスを動的に制御",
      "DynamoDB の LeadingKeys 条件で自分のデータのみアクセス可能に",
      "server_side_token_check = true でトークン検証をサーバーサイドで実施",
      "Token 型ロールマッピングでグループに応じた IAM ロールを自動割り当て",
    ],
    warnings: [
      "allow_unauthenticated_identities は本番では false 推奨",
    ],
  },
];

// ─── ALB + Cognito ───
const albAuthSections: Section[] = [
  {
    title: "ALB + Cognito 認証",
    description:
      "Application Load BalancerにCognito認証を統合し、ECSタスクの前段で認証を処理する構成です。アプリケーションコードの変更なしで認証を追加できます。",
    code: `# ============================
# ALB リスナールール（Cognito認証付き）
# ============================
resource "aws_lb_listener_rule" "auth" {
  listener_arn = var.alb_listener_arn
  priority     = 100

  action {
    type = "authenticate-cognito"

    authenticate_cognito {
      user_pool_arn       = aws_cognito_user_pool.main.arn
      user_pool_client_id = aws_cognito_user_pool_client.alb.id
      user_pool_domain    = aws_cognito_user_pool_domain.main.domain

      on_unauthenticated_request = "authenticate"
      scope                      = "openid email profile"
      session_cookie_name        = "AWSELBAuthSessionCookie"
      session_timeout            = 3600
    }
  }

  action {
    type             = "forward"
    target_group_arn = var.target_group_arn
  }

  condition {
    path_pattern {
      values = ["/app/*", "/dashboard/*"]
    }
  }
}

# 公開ページ（認証不要）
resource "aws_lb_listener_rule" "public" {
  listener_arn = var.alb_listener_arn
  priority     = 200

  action {
    type             = "forward"
    target_group_arn = var.target_group_arn
  }

  condition {
    path_pattern {
      values = ["/", "/health", "/public/*"]
    }
  }
}

# ALB用アプリクライアント
resource "aws_cognito_user_pool_client" "alb" {
  name         = "\${var.project}-alb-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret                      = true
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO"]

  callback_urls = [
    "https://\${var.domain_name}/oauth2/idpresponse"
  ]

  logout_urls = [
    "https://\${var.domain_name}/"
  ]
}

# Cognito ドメイン
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "\${var.project}-\${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id
}

variable "alb_listener_arn" {
  description = "ALBリスナーARN"
  type        = string
}

variable "target_group_arn" {
  description = "ターゲットグループARN"
  type        = string
}`,
    tips: [
      "ALB認証はアプリコード変更なしで認証を追加可能",
      "on_unauthenticated_request = authenticate で未認証を自動リダイレクト",
      "callback_urls は /oauth2/idpresponse（ALB固有パス）を必ず含める",
      "公開ページは別ルールで認証をスキップ",
    ],
    warnings: [
      "ALB用クライアントは generate_secret = true が必須",
      "ALBのCognito認証はHTTPSリスナーでのみ動作",
    ],
  },
];

// ─── API Gateway 連携 ───
const apiGwSections: Section[] = [
  {
    title: "API Gateway + Cognito Authorizer",
    description:
      "API GatewayのHTTP APIにCognitoオーソライザーを設定し、JWTトークンでAPIを保護する構成です。",
    code: `# ============================
# API Gateway（HTTP API）
# ============================
resource "aws_apigatewayv2_api" "main" {
  name          = "\${var.project}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["https://\${var.domain_name}"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Authorization", "Content-Type"]
    max_age       = 3600
  }

  tags = {
    Name = "\${var.project}-api"
  }
}

# ============================
# Cognito JWT Authorizer
# ============================
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "\${var.project}-cognito-auth"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.spa.id]
    issuer   = "https://\${aws_cognito_user_pool.main.endpoint}"
  }
}

# ============================
# ルート（認証付き）
# ============================
resource "aws_apigatewayv2_route" "get_items" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /items"
  target             = "integrations/\${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id

  authorization_scopes = ["\${aws_cognito_resource_server.api.identifier}/read"]
}

resource "aws_apigatewayv2_route" "post_items" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /items"
  target             = "integrations/\${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id

  authorization_scopes = [
    "\${aws_cognito_resource_server.api.identifier}/read",
    "\${aws_cognito_resource_server.api.identifier}/write"
  ]
}

# 公開ルート（認証なし）
resource "aws_apigatewayv2_route" "health" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /health"
  target    = "integrations/\${aws_apigatewayv2_integration.lambda.id}"
}

# Lambda 統合
resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.lambda_function_arn
  payload_format_version = "2.0"
}

# ステージ
resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = var.environment
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      caller         = "$context.identity.caller"
      user           = "$context.identity.user"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      resourcePath   = "$context.resourcePath"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
    })
  }

  tags = {
    Name = "\${var.project}-\${var.environment}"
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/api-gateway/\${var.project}"
  retention_in_days = 30

  tags = {
    Name = "\${var.project}-api-logs"
  }
}

variable "lambda_function_arn" {
  description = "Lambda関数ARN"
  type        = string
}`,
    tips: [
      "HTTP API + JWT Authorizer はREST APIより低コスト・高パフォーマンス",
      "authorization_scopes でルートごとに必要スコープを制御",
      "access_log_settings でAPI呼び出しを監査ログに記録",
      "CORS設定はAPI Gateway側で一元管理",
    ],
  },
];

// ─── Lambda トリガー ───
const lambdaAuthSections: Section[] = [
  {
    title: "Lambda トリガー（認証フローカスタマイズ）",
    description:
      "サインアップ前検証、カスタムメッセージ、トークン生成前のカスタマイズなど、Cognito認証フローをLambdaで拡張する構成です。",
    code: `# ============================
# ユーザープール Lambda トリガー設定
# ============================
resource "aws_cognito_user_pool" "main_with_triggers" {
  name = "\${var.project}-\${var.environment}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }

  # Lambda トリガー
  lambda_config {
    pre_sign_up                    = aws_lambda_function.pre_signup.arn
    post_confirmation              = aws_lambda_function.post_confirmation.arn
    pre_token_generation           = aws_lambda_function.pre_token.arn
    custom_message                 = aws_lambda_function.custom_message.arn
    post_authentication            = aws_lambda_function.post_auth.arn
  }

  tags = {
    Name = "\${var.project}-user-pool"
  }
}

# ============================
# サインアップ前検証（ドメイン制限など）
# ============================
resource "aws_lambda_function" "pre_signup" {
  function_name = "\${var.project}-pre-signup"
  role          = aws_iam_role.cognito_trigger.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = data.archive_file.pre_signup.output_path
  timeout       = 5

  environment {
    variables = {
      ALLOWED_DOMAINS = "example.com,example.co.jp"
    }
  }

  tags = {
    Name = "\${var.project}-pre-signup"
  }
}

# ============================
# 確認後処理（DynamoDBにユーザー情報保存）
# ============================
resource "aws_lambda_function" "post_confirmation" {
  function_name = "\${var.project}-post-confirmation"
  role          = aws_iam_role.cognito_trigger.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = data.archive_file.post_confirmation.output_path
  timeout       = 10

  environment {
    variables = {
      USERS_TABLE = var.users_table_name
    }
  }

  tags = {
    Name = "\${var.project}-post-confirmation"
  }
}

# ============================
# トークン生成前（カスタムクレーム追加）
# ============================
resource "aws_lambda_function" "pre_token" {
  function_name = "\${var.project}-pre-token"
  role          = aws_iam_role.cognito_trigger.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = data.archive_file.pre_token.output_path
  timeout       = 5

  environment {
    variables = {
      USERS_TABLE = var.users_table_name
    }
  }

  tags = {
    Name = "\${var.project}-pre-token"
  }
}

# カスタムメッセージ Lambda
resource "aws_lambda_function" "custom_message" {
  function_name = "\${var.project}-custom-message"
  role          = aws_iam_role.cognito_trigger.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = data.archive_file.custom_message.output_path
  timeout       = 5

  tags = {
    Name = "\${var.project}-custom-message"
  }
}

# 認証後処理 Lambda
resource "aws_lambda_function" "post_auth" {
  function_name = "\${var.project}-post-auth"
  role          = aws_iam_role.cognito_trigger.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = data.archive_file.post_auth.output_path
  timeout       = 5

  environment {
    variables = {
      AUDIT_TABLE = var.audit_table_name
    }
  }

  tags = {
    Name = "\${var.project}-post-auth"
  }
}

# ============================
# Lambda 実行権限（Cognito → Lambda）
# ============================
resource "aws_lambda_permission" "pre_signup" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pre_signup.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main_with_triggers.arn
}

resource "aws_lambda_permission" "post_confirmation" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post_confirmation.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main_with_triggers.arn
}

resource "aws_lambda_permission" "pre_token" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pre_token.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main_with_triggers.arn
}

resource "aws_lambda_permission" "custom_message" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.custom_message.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main_with_triggers.arn
}

resource "aws_lambda_permission" "post_auth" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post_auth.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main_with_triggers.arn
}

# トリガー用 IAM ロール
resource "aws_iam_role" "cognito_trigger" {
  name = "\${var.project}-cognito-trigger-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "\${var.project}-cognito-trigger-role"
  }
}

resource "aws_iam_role_policy_attachment" "cognito_trigger_logs" {
  role       = aws_iam_role.cognito_trigger.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "cognito_trigger_dynamodb" {
  name = "\${var.project}-trigger-dynamodb"
  role = aws_iam_role.cognito_trigger.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query"
        ]
        Resource = [
          var.app_table_arn,
          "\${var.app_table_arn}/index/*"
        ]
      }
    ]
  })
}

# ダミーのアーカイブ（実際はソースコードを配置）
data "archive_file" "pre_signup" {
  type        = "zip"
  output_path = "\${path.module}/lambda/pre_signup.zip"
  source {
    content  = "exports.handler = async (event) => { return event; };"
    filename = "index.js"
  }
}

data "archive_file" "post_confirmation" {
  type        = "zip"
  output_path = "\${path.module}/lambda/post_confirmation.zip"
  source {
    content  = "exports.handler = async (event) => { return event; };"
    filename = "index.js"
  }
}

data "archive_file" "pre_token" {
  type        = "zip"
  output_path = "\${path.module}/lambda/pre_token.zip"
  source {
    content  = "exports.handler = async (event) => { return event; };"
    filename = "index.js"
  }
}

data "archive_file" "custom_message" {
  type        = "zip"
  output_path = "\${path.module}/lambda/custom_message.zip"
  source {
    content  = "exports.handler = async (event) => { return event; };"
    filename = "index.js"
  }
}

data "archive_file" "post_auth" {
  type        = "zip"
  output_path = "\${path.module}/lambda/post_auth.zip"
  source {
    content  = "exports.handler = async (event) => { return event; };"
    filename = "index.js"
  }
}

variable "users_table_name" {
  description = "ユーザーテーブル名"
  type        = string
}

variable "audit_table_name" {
  description = "監査ログテーブル名"
  type        = string
  default     = ""
}`,
    tips: [
      "pre_sign_up でドメイン制限（社内ユーザーのみ登録許可など）",
      "post_confirmation でDynamoDBにユーザープロファイルを自動作成",
      "pre_token_generation でJWTにカスタムクレーム（権限情報など）を追加",
      "post_authentication でログイン履歴を監査テーブルに記録",
    ],
    warnings: [
      "Lambdaトリガーのタイムアウトは5秒が推奨（認証UXに直結）",
      "lambda_permission を忘れると Cognito から Lambda を呼べない",
    ],
  },
];

// ─── カスタムドメイン ───
const customDomainSections: Section[] = [
  {
    title: "Cognito カスタムドメイン + ACM証明書",
    description:
      "Cognitoのホストされた認証UIに独自ドメインを設定し、ブランドに合わせた認証エクスペリエンスを提供します。",
    code: `# ============================
# カスタムドメイン
# ============================
resource "aws_cognito_user_pool_domain" "custom" {
  domain          = "auth.\${var.domain_name}"
  certificate_arn = aws_acm_certificate.auth.arn
  user_pool_id    = aws_cognito_user_pool.main.id
}

# ACM 証明書（us-east-1 に作成が必要）
resource "aws_acm_certificate" "auth" {
  provider          = aws.us_east_1
  domain_name       = "auth.\${var.domain_name}"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "\${var.project}-auth-cert"
  }
}

# DNS 検証
resource "aws_route53_record" "auth_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.auth.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main.zone_id
}

resource "aws_acm_certificate_validation" "auth" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.auth.arn
  validation_record_fqdns = [for record in aws_route53_record.auth_cert_validation : record.fqdn]
}

# Cognito ドメインの DNS レコード
resource "aws_route53_record" "auth" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "auth.\${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cognito_user_pool_domain.custom.cloudfront_distribution
    zone_id                = aws_cognito_user_pool_domain.custom.cloudfront_distribution_zone_id
    evaluate_target_health = false
  }
}

data "aws_route53_zone" "main" {
  name = var.domain_name
}

# us-east-1 プロバイダー
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# ============================
# ホストされたUI カスタマイズ
# ============================
resource "aws_cognito_user_pool_ui_customization" "main" {
  user_pool_id = aws_cognito_user_pool.main.id
  client_id    = aws_cognito_user_pool_client.spa.id
  css          = file("\${path.module}/cognito-ui/custom.css")
  image_file   = filebase64("\${path.module}/cognito-ui/logo.png")
}`,
    tips: [
      "カスタムドメインの ACM 証明書は us-east-1 に作成が必要",
      "CloudFront ディストリビューション経由で配信される",
      "UI カスタマイズで企業ロゴ・CSSを適用可能",
    ],
    warnings: [
      "カスタムドメインの変更・削除には最大60分かかる場合がある",
    ],
  },
];

// ─── MFA・セキュリティ ───
const mfaSecuritySections: Section[] = [
  {
    title: "MFA（多要素認証）設定",
    description:
      "TOTPアプリ（Google Authenticator等）やSMSによる多要素認証を設定し、アカウントセキュリティを強化します。",
    code: `# ============================
# MFA 有効化済みユーザープール
# ============================
resource "aws_cognito_user_pool" "secure" {
  name = "\${var.project}-\${var.environment}-secure"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # MFA設定
  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  # SMS MFA（オプション）
  sms_configuration {
    external_id    = "\${var.project}-cognito-sms"
    sns_caller_arn = aws_iam_role.cognito_sms.arn
    sns_region     = var.region
  }

  # パスワードポリシー
  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 1
  }

  # 高度なセキュリティ
  user_pool_add_ons {
    advanced_security_mode = "ENFORCED"
  }

  # アカウント復旧
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  tags = {
    Name        = "\${var.project}-secure-pool"
    Environment = var.environment
  }
}

# SMS 送信用 IAM ロール
resource "aws_iam_role" "cognito_sms" {
  name = "\${var.project}-cognito-sms"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "cognito-idp.amazonaws.com"
        }
        Action = "sts:AssumeRole"
        Condition = {
          StringEquals = {
            "sts:ExternalId" = "\${var.project}-cognito-sms"
          }
        }
      }
    ]
  })

  tags = {
    Name = "\${var.project}-cognito-sms-role"
  }
}

resource "aws_iam_role_policy" "cognito_sms" {
  name = "\${var.project}-sms-publish"
  role = aws_iam_role.cognito_sms.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "sns:Publish"
        Resource = "*"
      }
    ]
  })
}

# ============================
# WAF（ブルートフォース防止）
# ============================
resource "aws_wafv2_web_acl" "cognito" {
  provider = aws.us_east_1
  name     = "\${var.project}-cognito-waf"
  scope    = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "RateLimitLogin"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 100
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "\${var.project}-login-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "\${var.project}-common-rules"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "\${var.project}-cognito-waf"
    sampled_requests_enabled   = true
  }

  tags = {
    Name = "\${var.project}-cognito-waf"
  }
}

resource "aws_wafv2_web_acl_association" "cognito" {
  resource_arn = aws_cognito_user_pool.secure.arn
  web_acl_arn  = aws_wafv2_web_acl.cognito.arn
}`,
    tips: [
      "mfa_configuration = OPTIONAL でユーザーにMFA設定を推奨（強制は REQUIRED）",
      "TOTP（アプリ型）はSMSより安全でコストもかからない",
      "WAFでIPベースのレート制限を設定し、ブルートフォース攻撃を防止",
      "advanced_security_mode = ENFORCED でリスクベース認証が有効に",
    ],
    warnings: [
      "SMS MFA は SNS 料金が発生する（特に国際SMS）",
      "mfa_configuration を REQUIRED に変更すると既存ユーザーがロックアウトされる可能性",
    ],
  },
];

// ─── マルチ環境運用 ───
const multiEnvSections: Section[] = [
  {
    title: "マルチ環境構成（モジュール化）",
    description:
      "dev/staging/prod 環境ごとにCognitoリソースをモジュール化し、環境差異を変数で管理する構成です。",
    code: `# ============================
# modules/cognito/main.tf
# ============================
resource "aws_cognito_user_pool" "this" {
  name = "\${var.project}-\${var.environment}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  mfa_configuration = var.mfa_required ? "REQUIRED" : "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  password_policy {
    minimum_length    = var.password_min_length
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = var.environment == "prod"
  }

  user_pool_add_ons {
    advanced_security_mode = var.environment == "prod" ? "ENFORCED" : "AUDIT"
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  dynamic "lambda_config" {
    for_each = var.enable_triggers ? [1] : []
    content {
      pre_sign_up        = var.pre_signup_lambda_arn
      post_confirmation  = var.post_confirmation_lambda_arn
      pre_token_generation = var.pre_token_lambda_arn
    }
  }

  tags = merge(var.tags, {
    Name        = "\${var.project}-\${var.environment}-user-pool"
    Environment = var.environment
  })
}

resource "aws_cognito_user_pool_client" "spa" {
  name         = "\${var.project}-spa-client"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO"]

  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls

  access_token_validity  = var.access_token_hours
  id_token_validity      = var.id_token_hours
  refresh_token_validity = var.refresh_token_days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  enable_token_revocation       = true
  prevent_user_existence_errors = "ENABLED"
}

resource "aws_cognito_user_pool_domain" "this" {
  domain       = var.custom_domain != "" ? var.custom_domain : "\${var.project}-\${var.environment}"
  user_pool_id = aws_cognito_user_pool.this.id

  certificate_arn = var.custom_domain != "" ? var.certificate_arn : null
}

# ============================
# modules/cognito/variables.tf
# ============================
variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "mfa_required" {
  type    = bool
  default = false
}

variable "password_min_length" {
  type    = number
  default = 12
}

variable "callback_urls" {
  type = list(string)
}

variable "logout_urls" {
  type = list(string)
}

variable "access_token_hours" {
  type    = number
  default = 1
}

variable "id_token_hours" {
  type    = number
  default = 1
}

variable "refresh_token_days" {
  type    = number
  default = 30
}

variable "enable_triggers" {
  type    = bool
  default = false
}

variable "pre_signup_lambda_arn" {
  type    = string
  default = ""
}

variable "post_confirmation_lambda_arn" {
  type    = string
  default = ""
}

variable "pre_token_lambda_arn" {
  type    = string
  default = ""
}

variable "custom_domain" {
  type    = string
  default = ""
}

variable "certificate_arn" {
  type    = string
  default = ""
}

variable "tags" {
  type    = map(string)
  default = {}
}

# ============================
# modules/cognito/outputs.tf
# ============================
output "user_pool_id" {
  value = aws_cognito_user_pool.this.id
}

output "user_pool_arn" {
  value = aws_cognito_user_pool.this.arn
}

output "user_pool_endpoint" {
  value = aws_cognito_user_pool.this.endpoint
}

output "client_id" {
  value = aws_cognito_user_pool_client.spa.id
}

output "domain" {
  value = aws_cognito_user_pool_domain.this.domain
}`,
    tips: [
      "dynamic ブロックで環境に応じてLambdaトリガーの有無を切り替え",
      "本番は ENFORCED、開発は AUDIT でセキュリティレベルを環境ごとに調整",
      "パスワードの symbols 要件を本番のみ必須に設定",
      "outputs で他モジュールから参照可能な値を公開",
    ],
  },
  {
    title: "環境ごとのモジュール呼び出し",
    description:
      "dev/staging/prod それぞれの環境でモジュールを呼び出す設定例です。",
    code: `# ============================
# environments/dev/main.tf
# ============================
module "cognito" {
  source = "../../modules/cognito"

  project     = "myapp"
  environment = "dev"

  mfa_required        = false
  password_min_length = 8

  callback_urls = [
    "http://localhost:3000/callback",
    "https://dev.example.com/callback"
  ]

  logout_urls = [
    "http://localhost:3000",
    "https://dev.example.com"
  ]

  access_token_hours = 8
  refresh_token_days = 90
  enable_triggers    = false

  tags = {
    Team = "development"
  }
}

# ============================
# environments/staging/main.tf
# ============================
module "cognito" {
  source = "../../modules/cognito"

  project     = "myapp"
  environment = "staging"

  mfa_required        = false
  password_min_length = 10

  callback_urls = [
    "https://staging.example.com/callback"
  ]

  logout_urls = [
    "https://staging.example.com"
  ]

  access_token_hours = 2
  refresh_token_days = 30
  enable_triggers    = true

  pre_signup_lambda_arn       = module.lambda.pre_signup_arn
  post_confirmation_lambda_arn = module.lambda.post_confirmation_arn
  pre_token_lambda_arn        = module.lambda.pre_token_arn

  tags = {
    Team = "qa"
  }
}

# ============================
# environments/prod/main.tf
# ============================
module "cognito" {
  source = "../../modules/cognito"

  project     = "myapp"
  environment = "prod"

  mfa_required        = true
  password_min_length = 12

  callback_urls = [
    "https://app.example.com/callback"
  ]

  logout_urls = [
    "https://app.example.com"
  ]

  access_token_hours = 1
  refresh_token_days = 7
  enable_triggers    = true

  pre_signup_lambda_arn       = module.lambda.pre_signup_arn
  post_confirmation_lambda_arn = module.lambda.post_confirmation_arn
  pre_token_lambda_arn        = module.lambda.pre_token_arn

  custom_domain   = "auth.example.com"
  certificate_arn = module.acm.auth_certificate_arn

  tags = {
    Team = "platform"
  }
}`,
    tips: [
      "開発環境: MFA不要、パスワード短め、localhost許可、トークン長寿命",
      "ステージング環境: 本番に近い設定でトリガーも有効化",
      "本番環境: MFA必須、パスワード厳格、カスタムドメイン、トークン短寿命",
      "環境差異は変数のみで制御し、モジュール本体は共通",
    ],
  },
];

// ─── タブとセクションのマッピング ───
function getSectionsForTab(tab: Tab): Section[] {
  const mapping: Record<Tab, Section[]> = {
    overview: [],
    "user-pool": userPoolSections,
    "app-client": appClientSections,
    "identity-pool": identityPoolSections,
    "alb-auth": albAuthSections,
    "api-gw": apiGwSections,
    "lambda-auth": lambdaAuthSections,
    "custom-domain": customDomainSections,
    "mfa-security": mfaSecuritySections,
    "multi-env": multiEnvSections,
  };
  return mapping[tab];
}

// ─── 全体像タブ ───
function OverviewTab() {
  const flows = [
    {
      title: "SPA + Cognito + API Gateway",
      description: "フロントエンドアプリがCognitoで認証し、APIにアクセス",
      steps: ["SPA", "→ Cognito", "→ JWT", "→ API Gateway", "→ Lambda"],
      color: "bg-blue-100 text-blue-800",
    },
    {
      title: "ALB + Cognito + ECS",
      description: "ALBでCognito認証を処理、ECSへ透過的に転送",
      steps: ["Client", "→ ALB (Cognito)", "→ ECS Fargate"],
      color: "bg-green-100 text-green-800",
    },
    {
      title: "IDプール + S3/DynamoDB 直接アクセス",
      description: "一時認証情報でAWSリソースに直接アクセス",
      steps: ["Client", "→ Cognito", "→ STS", "→ S3 / DynamoDB"],
      color: "bg-amber-100 text-amber-800",
    },
    {
      title: "Lambda トリガーによる認証フロー拡張",
      description: "サインアップ・トークン生成をカスタムロジックで拡張",
      steps: ["SignUp", "→ Pre-SignUp λ", "→ Post-Confirm λ", "→ DynamoDB"],
      color: "bg-purple-100 text-purple-800",
    },
  ];

  const components = [
    { icon: Users, name: "ユーザープール", desc: "ユーザー登録・認証・パスワード管理", color: "text-blue-600" },
    { icon: Key, name: "アプリクライアント", desc: "OAuth 2.0 フロー設定・トークン管理", color: "text-cyan-600" },
    { icon: Shield, name: "IDプール", desc: "AWS一時認証情報の発行・IAMロール割当", color: "text-green-600" },
    { icon: Lock, name: "MFA / セキュリティ", desc: "多要素認証・WAF・リスクベース認証", color: "text-red-600" },
    { icon: Mail, name: "メール / SMS", desc: "検証コード・招待メール・カスタムメッセージ", color: "text-orange-600" },
    { icon: Globe, name: "カスタムドメイン", desc: "独自ドメインでの認証UI・ブランディング", color: "text-indigo-600" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-[16px] font-medium mb-4">Cognito コンポーネント</h3>
        <div className="grid grid-cols-2 gap-3">
          {components.map((c) => (
            <div key={c.name} className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
              <c.icon className={`w-5 h-5 ${c.color} shrink-0 mt-0.5`} />
              <div>
                <span className="text-[13px] font-medium">{c.name}</span>
                <p className="text-[12px] text-muted-foreground mt-0.5">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-[16px] font-medium mb-4">認証フローパターン</h3>
        <div className="grid grid-cols-1 gap-4">
          {flows.map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-xl p-5">
              <h4 className="text-[14px] font-medium mb-1">{f.title}</h4>
              <p className="text-[13px] text-muted-foreground mb-3">{f.description}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {f.steps.map((step, i) => (
                  <span key={i} className={`text-[12px] px-2.5 py-1 rounded-full ${step.startsWith("→") ? "text-muted-foreground" : f.color}`}>
                    {step}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── セクションリスト ───
function SectionList({ sections }: { sections: Section[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-4">
      {sections.map((section, index) => {
        const isOpen = openIndex === index;

        return (
          <div key={index} className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="w-full flex items-center justify-between p-5 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center text-[13px]">
                  {index + 1}
                </div>
                <div>
                  <h4 className="text-[14px] font-medium">{section.title}</h4>
                  <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-1">
                    {section.description}
                  </p>
                </div>
              </div>
              {isOpen ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
              )}
            </button>

            {isOpen && (
              <div className="px-5 pb-5 space-y-4">
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  {section.description}
                </p>

                <div>
                  <pre className="bg-zinc-950 text-zinc-100 rounded-lg p-4 overflow-x-auto text-[12px] leading-relaxed">
                    <code>{section.code}</code>
                  </pre>
                  <div className="mt-2">
                    <DownloadCodeButton
                      code={section.code}
                      filename={`${section.title.replace(/[^a-zA-Z0-9\u3040-\u9FFF]/g, "_")}.tf`}
                    />
                  </div>
                </div>

                {section.tips && section.tips.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-[12px] font-medium text-emerald-700">ベストプラクティス</span>
                    </div>
                    <ul className="space-y-1.5">
                      {section.tips.map((tip, i) => (
                        <li key={i} className="text-[12px] text-emerald-700 flex items-start gap-2">
                          <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {section.warnings && section.warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="text-[12px] font-medium text-amber-700">注意点</span>
                    </div>
                    <ul className="space-y-1.5">
                      {section.warnings.map((w, i) => (
                        <li key={i} className="text-[12px] text-amber-700 flex items-start gap-2">
                          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── メインコンポーネント ───
export function CognitoAuth() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const sections = getSectionsForTab(activeTab);

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-[24px] font-bold mb-2">Cognito 認証設計</h1>
          <p className="text-[14px] text-muted-foreground">
            AWS Cognito を使った認証・認可のTerraform設計パターン集 — ユーザープール、IDプール、ALB/API Gateway連携、MFA、マルチ環境運用
          </p>
        </div>

        {/* タブ */}
        <div className="flex flex-wrap gap-2 mb-8">
          {tabItems.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] transition-colors ${
                activeTab === tab.id
                  ? `${tab.color} text-white`
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* コンテンツ */}
        {activeTab === "overview" ? <OverviewTab /> : <SectionList sections={sections} />}
      </div>
    </main>
  );
}
