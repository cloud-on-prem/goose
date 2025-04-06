use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub enum Permission {
    AlwaysAllow,
    AllowOnce,
    DenyOnce,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub enum PrincipalType {
    Extention,
    Tool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PermissionConfirmation {
    pub principal_name: String,
    pub principal_type: PrincipalType,
    pub permission: Permission,
}
