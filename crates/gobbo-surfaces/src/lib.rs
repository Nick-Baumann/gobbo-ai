//! Surface (messaging adapter) primitives.

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Surface {
    WhatsApp,
    Telegram,
    Discord,
    IMessage,
    WebChat,
    Voice,
}

impl Surface {
    pub fn slug(self) -> &'static str {
        match self {
            Surface::WhatsApp => "whatsapp",
            Surface::Telegram => "telegram",
            Surface::Discord => "discord",
            Surface::IMessage => "imessage",
            Surface::WebChat => "webchat",
            Surface::Voice => "voice",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Recipient {
    pub surface: Surface,
    pub address: String,
}

impl Recipient {
    pub fn new(surface: Surface, address: impl Into<String>) -> Self {
        Self {
            surface,
            address: address.into(),
        }
    }

    /// Whether this recipient looks like a group (Telegram, Discord channel).
    pub fn is_group(&self) -> bool {
        match self.surface {
            Surface::Telegram | Surface::Discord => {
                self.address.starts_with('-')
                    || self.address.starts_with('#')
                    || self.address.starts_with("group:")
            }
            _ => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn surface_slug_round_trips() {
        assert_eq!(Surface::Telegram.slug(), "telegram");
        assert_eq!(Surface::IMessage.slug(), "imessage");
    }

    #[test]
    fn telegram_group_addresses_detected() {
        let r = Recipient::new(Surface::Telegram, "-100123456");
        assert!(r.is_group());

        let dm = Recipient::new(Surface::Telegram, "12345");
        assert!(!dm.is_group());
    }
}
