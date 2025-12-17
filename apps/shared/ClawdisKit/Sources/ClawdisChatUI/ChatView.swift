import SwiftUI

@MainActor
public struct ClawdisChatView: View {
    @State private var viewModel: ClawdisChatViewModel
    @State private var scrollerBottomID = UUID()
    @State private var showSessions = false
    private let showsSessionSwitcher: Bool

    private enum Layout {
        #if os(macOS)
        static let outerPadding: CGFloat = 2
        static let stackSpacing: CGFloat = 3
        static let messageSpacing: CGFloat = 8
        static let messageListPaddingTop: CGFloat = 0
        static let messageListPaddingBottom: CGFloat = 2
        static let messageListPaddingHorizontal: CGFloat = 4
        #else
        static let outerPadding: CGFloat = 6
        static let stackSpacing: CGFloat = 6
        static let messageSpacing: CGFloat = 12
        static let messageListPaddingTop: CGFloat = 4
        static let messageListPaddingBottom: CGFloat = 6
        static let messageListPaddingHorizontal: CGFloat = 8
        #endif
    }

    public init(viewModel: ClawdisChatViewModel, showsSessionSwitcher: Bool = false) {
        self._viewModel = State(initialValue: viewModel)
        self.showsSessionSwitcher = showsSessionSwitcher
    }

    public var body: some View {
        ZStack {
            ClawdisChatTheme.surface
                .ignoresSafeArea()

            VStack(spacing: Layout.stackSpacing) {
                self.messageList
                ClawdisChatComposer(viewModel: self.viewModel)
            }
            .padding(.horizontal, Layout.outerPadding)
            .padding(.vertical, Layout.outerPadding)
            .frame(maxWidth: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .onAppear { self.viewModel.load() }
        .sheet(isPresented: self.$showSessions) {
            if self.showsSessionSwitcher {
                ChatSessionsSheet(viewModel: self.viewModel)
            } else {
                EmptyView()
            }
        }
    }

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: Layout.messageSpacing) {
                    ForEach(self.viewModel.messages) { msg in
                        ChatMessageBubble(message: msg)
                            .frame(
                                maxWidth: .infinity,
                                alignment: msg.role.lowercased() == "user" ? .trailing : .leading)
                    }

                    if self.viewModel.pendingRunCount > 0 {
                        ChatTypingIndicatorBubble()
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    if !self.viewModel.pendingToolCalls.isEmpty {
                        ChatPendingToolsBubble(toolCalls: self.viewModel.pendingToolCalls)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    if let text = self.viewModel.streamingAssistantText, !text.isEmpty {
                        ChatStreamingAssistantBubble(text: text)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Color.clear
                        .frame(height: 1)
                        .id(self.scrollerBottomID)
                }
                .padding(.top, Layout.messageListPaddingTop)
                .padding(.bottom, Layout.messageListPaddingBottom)
                .padding(.horizontal, Layout.messageListPaddingHorizontal)
            }
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(ClawdisChatTheme.card)
                    .shadow(color: .black.opacity(0.05), radius: 12, y: 6))
            .onChange(of: self.viewModel.messages.count) { _, _ in
                withAnimation(.snappy(duration: 0.22)) {
                    proxy.scrollTo(self.scrollerBottomID, anchor: .bottom)
                }
            }
            .onChange(of: self.viewModel.pendingRunCount) { _, _ in
                withAnimation(.snappy(duration: 0.22)) {
                    proxy.scrollTo(self.scrollerBottomID, anchor: .bottom)
                }
            }
        }
    }
}
