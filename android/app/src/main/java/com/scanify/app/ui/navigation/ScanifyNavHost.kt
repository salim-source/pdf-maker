package com.scanify.app.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.QrCode2
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.scanify.app.data.local.PreferencesRepository
import com.scanify.app.data.repository.ScanifyRepository
import com.scanify.app.ui.screens.HistoryScreen
import com.scanify.app.ui.screens.HomeScreen
import com.scanify.app.ui.screens.PdfManagerScreen
import com.scanify.app.ui.screens.PdfReaderScreen
import com.scanify.app.ui.screens.QrGeneratorScreen
import com.scanify.app.ui.screens.QrScannerScreen
import com.scanify.app.ui.screens.SettingsScreen

sealed class Route(val path: String, val label: String, val icon: ImageVector) {
    data object Home : Route("home", "Home", Icons.Outlined.Home)
    data object Reader : Route("reader", "Reader", Icons.Outlined.Description)
    data object Scanner : Route("scanner", "Scan", Icons.Outlined.QrCodeScanner)
    data object Generator : Route("generator", "Create", Icons.Outlined.QrCode2)
    data object Documents : Route("documents", "Library", Icons.Outlined.FolderOpen)
    data object History : Route("history", "History", Icons.Outlined.QrCodeScanner)
    data object Settings : Route("settings", "Settings", Icons.Outlined.Home)
}

private val BottomRoutes = listOf(
    Route.Home,
    Route.Reader,
    Route.Scanner,
    Route.Generator,
    Route.Documents
)

@Composable
fun ScanifyNavHost(
    repository: ScanifyRepository,
    preferencesRepository: PreferencesRepository
) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route ?: Route.Home.path

    Scaffold(
        bottomBar = {
            NavigationBar {
                BottomRoutes.forEach { item ->
                    val selected = currentRoute.startsWith(item.path)
                    NavigationBarItem(
                        selected = selected,
                        onClick = {
                            navController.navigate(item.path) {
                                popUpTo(Route.Home.path) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(item.icon, contentDescription = item.label) },
                        label = { Text(item.label) }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Route.Home.path,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Route.Home.path) {
                HomeScreen(
                    repository = repository,
                    onOpenReader = { docId ->
                        navController.navigate(if (docId != null) "reader/$docId" else Route.Reader.path)
                    },
                    onOpenScanner = { navController.navigate(Route.Scanner.path) },
                    onOpenGenerator = { navController.navigate(Route.Generator.path) },
                    onOpenHistory = { navController.navigate(Route.History.path) },
                    onOpenSettings = { navController.navigate(Route.Settings.path) }
                )
            }
            composable(Route.Reader.path) {
                PdfReaderScreen(repository = repository, docId = null)
            }
            composable(
                route = "reader/{docId}",
                arguments = listOf(navArgument("docId") { type = NavType.StringType })
            ) { entry ->
                PdfReaderScreen(
                    repository = repository,
                    docId = entry.arguments?.getString("docId")
                )
            }
            composable(Route.Scanner.path) {
                QrScannerScreen(
                    repository = repository,
                    preferencesRepository = preferencesRepository
                )
            }
            composable(Route.Generator.path) {
                QrGeneratorScreen(repository = repository)
            }
            composable(Route.Documents.path) {
                PdfManagerScreen(
                    repository = repository,
                    onOpenDoc = { docId -> navController.navigate("reader/$docId") }
                )
            }
            composable(Route.History.path) {
                HistoryScreen(repository = repository)
            }
            composable(Route.Settings.path) {
                SettingsScreen(
                    repository = repository,
                    preferencesRepository = preferencesRepository
                )
            }
        }
    }
}
