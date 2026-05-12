package com.nickbaumann.gobbo.node.ui

import androidx.compose.runtime.Composable
import com.nickbaumann.gobbo.node.MainViewModel
import com.nickbaumann.gobbo.node.ui.chat.ChatSheetContent

@Composable
fun ChatSheet(viewModel: MainViewModel) {
  ChatSheetContent(viewModel = viewModel)
}
