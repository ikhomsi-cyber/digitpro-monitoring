"""Generate the two-target Xcode project without third-party tooling."""
from pathlib import Path
import hashlib
import json
import plistlib
root = Path(__file__).resolve().parent
objects = {}
def uid(label): return hashlib.sha1(label.encode()).hexdigest()[:24].upper()
def obj(label, body):
    ident = uid(label); objects[ident] = body; return ident
def q(s): return json.dumps(str(s))
def ids(values): return '(' + ', '.join(values) + (',' if values else '') + ')'
def ref(path, kind='sourcecode.swift'):
    return obj('file:'+path, f'isa = PBXFileReference; lastKnownFileType = {kind}; path = {q(path)}; sourceTree = SOURCE_ROOT;')
app_sources = sorted(str(p.relative_to(root)) for p in (root/'DigitPro').rglob('*.swift') if 'Widget' not in p.parts)
widget_sources = ['DigitPro/Shared/WidgetCache.swift', 'DigitPro/Widget/DigitProWidget.swift']
files = {p: ref(p) for p in sorted(set(app_sources+widget_sources))}
assets = ref('DigitPro/Assets.xcassets', 'folder.assetcatalog')
base = ref('DigitPro/Config/Base.xcconfig', 'text.xcconfig')
products = []
configs = {}
for target, bundle, product in [('DigitPro','fr.digitpro.ios','DigitPro.app'), ('DigitProWidget','fr.digitpro.ios.widget','DigitProWidget.appex')]:
    products.append(obj('product:'+target, f'isa = PBXFileReference; explicitFileType = {"wrapper.application" if target == "DigitPro" else "wrapper.app-extension"}; path = {q(product)}; sourceTree = BUILT_PRODUCTS_DIR;'))
    target_configs = []
    for config in ['Debug','Release']:
        settings = {
            'PRODUCT_BUNDLE_IDENTIFIER': bundle, 'PRODUCT_NAME': '$(TARGET_NAME)',
            'SWIFT_VERSION': '5.0', 'IPHONEOS_DEPLOYMENT_TARGET':'17.0',
            'ONLY_ACTIVE_ARCH': 'YES' if config == 'Debug' else 'NO',
            'TARGETED_DEVICE_FAMILY':'1,2', 'SDKROOT':'iphoneos',
            'CODE_SIGN_STYLE':'Automatic', 'CURRENT_PROJECT_VERSION':'1', 'MARKETING_VERSION':'1.0.0',
            'INFOPLIST_FILE': f'DigitPro/Config/{target}-Info.plist',
            'CODE_SIGN_ENTITLEMENTS': 'DigitPro/Config/DigitPro.entitlements',
            'SWIFT_OPTIMIZATION_LEVEL': '-Onone' if config == 'Debug' else '-O',
            'LD_RUNPATH_SEARCH_PATHS':'$(inherited) @executable_path/Frameworks' + (' @executable_path/../../Frameworks' if target != 'DigitPro' else ''),
            'GENERATE_INFOPLIST_FILE':'NO', 'ENABLE_USER_SCRIPT_SANDBOXING':'YES',
            'COPY_PHASE_STRIP': 'NO'
        }
        if target == 'DigitPro': settings['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon'
        if target != 'DigitPro': settings.update(SKIP_INSTALL='YES',APPLICATION_EXTENSION_API_ONLY='YES')
        target_configs.append(obj(target+config, 'isa = XCBuildConfiguration; baseConfigurationReference = '+base+'; name = '+q(config)+'; buildSettings = {'+' '.join(k+' = '+q(v)+';' for k,v in settings.items())+'};'))
    configs[target] = obj('config:'+target, f'isa = XCConfigurationList; buildConfigurations = {ids(target_configs)}; defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
package = obj('supabase', 'isa = XCRemoteSwiftPackageReference; repositoryURL = "https://github.com/supabase/supabase-swift.git"; requirement = {kind = exactVersion; version = 2.48.0;};')
package_product = obj('SupabaseProduct', f'isa = XCSwiftPackageProductDependency; package = {package}; productName = Supabase;')
package_build = obj('SupabaseBuild',f'isa = PBXBuildFile; productRef = {package_product};')
for target, sources in [('DigitPro',app_sources),('DigitProWidget',widget_sources)]:
    builds = [obj(target+':'+p,f'isa = PBXBuildFile; fileRef = {files[p]};') for p in sources]
    obj('sources:'+target,f'isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = {ids(builds)}; runOnlyForDeploymentPostprocessing = 0;')
    obj('frameworks:'+target,f'isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = {ids([package_build] if target == "DigitPro" else [])}; runOnlyForDeploymentPostprocessing = 0;')
    resource_builds = [obj(target+':assets', f'isa = PBXBuildFile; fileRef = {assets};')] if target == 'DigitPro' else []
    obj('resources:'+target,f'isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = {ids(resource_builds)}; runOnlyForDeploymentPostprocessing = 0;')
proxy = obj('proxy',f'isa = PBXContainerItemProxy; containerPortal = {uid("project")}; proxyType = 1; remoteGlobalIDString = {uid("target:DigitProWidget")}; remoteInfo = DigitProWidget;')
dependency = obj('dependency',f'isa = PBXTargetDependency; target = {uid("target:DigitProWidget")}; targetProxy = {proxy};')
embed_build = obj('embedBuild', f'isa = PBXBuildFile; fileRef = {products[1]}; settings = {{ATTRIBUTES = (RemoveHeadersOnCopy,);}};')
embed = obj('embed',f'isa = PBXCopyFilesBuildPhase; buildActionMask = 2147483647; dstPath = ""; dstSubfolderSpec = 13; files = ({embed_build},); name = "Embed App Extensions"; runOnlyForDeploymentPostprocessing = 0;')
for index,target in enumerate(['DigitPro','DigitProWidget']):
    phases = [uid('sources:'+target),uid('frameworks:'+target),uid('resources:'+target)] + ([embed] if index == 0 else [])
    obj('target:'+target, f'isa = PBXNativeTarget; buildConfigurationList = {configs[target]}; buildPhases = {ids(phases)}; buildRules = (); dependencies = {ids([dependency] if index == 0 else [])}; name = {target}; packageProductDependencies = {ids([package_product] if index == 0 else [])}; productName = {target}; productReference = {products[index]}; productType = "com.apple.product-type.{"application" if index == 0 else "app-extension"}";')
product_group = obj('products',f'isa = PBXGroup; children = {ids(products)}; name = Products; sourceTree = "<group>";')
main_group = obj('main',f'isa = PBXGroup; children = {ids(list(files.values())+[assets,base,product_group])}; sourceTree = "<group>";')
project_configs = []
for config in ['Debug','Release']:
    project_configs.append(obj('project'+config,f'isa = XCBuildConfiguration; name = {config}; buildSettings = {{CLANG_ENABLE_MODULES = YES; SWIFT_ACTIVE_COMPILATION_CONDITIONS = {q("DEBUG" if config == "Debug" else "")};}};'))
project_config = obj('projectConfigs',f'isa = XCConfigurationList; buildConfigurations = {ids(project_configs)}; defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
project = obj('project',f'isa = PBXProject; attributes = {{LastUpgradeCheck = 1600;}}; buildConfigurationList = {project_config}; compatibilityVersion = "Xcode 14.0"; developmentRegion = fr; hasScannedForEncodings = 0; knownRegions = (fr, en, Base); mainGroup = {main_group}; packageReferences = ({package},); productRefGroup = {product_group}; projectDirPath = ""; projectRoot = ""; targets = ({uid("target:DigitPro")}, {uid("target:DigitProWidget")},);')
folder = root/'DigitPro iOS.xcodeproj'; folder.mkdir(exist_ok=True)
(folder/'project.pbxproj').write_text('// !$*UTF8*$!\n{archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n'+'\n'.join(i+' = {'+body+'};' for i,body in objects.items())+'\n}; rootObject = '+project+';}\n')
for target in ['DigitPro','DigitProWidget']:
    info = dict(CFBundleDisplayName='DigitPro', CFBundleIdentifier='$(PRODUCT_BUNDLE_IDENTIFIER)',
        CFBundleExecutable='$(EXECUTABLE_NAME)', CFBundleName='$(PRODUCT_NAME)',
        CFBundlePackageType='APPL' if target=='DigitPro' else 'XPC!',
        CFBundleShortVersionString='$(MARKETING_VERSION)', CFBundleVersion='$(CURRENT_PROJECT_VERSION)',
        DIGITPRO_APP_GROUP='$(DIGITPRO_APP_GROUP)')
    if target == 'DigitPro':
        info.update(SUPABASE_URL='$(SUPABASE_URL)', SUPABASE_ANON_KEY='$(SUPABASE_ANON_KEY)', DIGITPRO_API_URL='$(DIGITPRO_API_URL)',
            NSFaceIDUsageDescription='Déverrouiller vos données financières DigitPro.',
            UILaunchScreen={}, UISupportedInterfaceOrientations=['UIInterfaceOrientationPortrait','UIInterfaceOrientationLandscapeLeft','UIInterfaceOrientationLandscapeRight'])
    else: info['NSExtension'] = {'NSExtensionPointIdentifier':'com.apple.widgetkit-extension'}
    (root/f'DigitPro/Config/{target}-Info.plist').write_bytes(plistlib.dumps(info))
(root/'DigitPro/Config/DigitPro.entitlements').write_bytes(plistlib.dumps({'com.apple.security.application-groups':['$(DIGITPRO_APP_GROUP)']}))
schemes=folder/'xcshareddata/xcschemes'; schemes.mkdir(parents=True,exist_ok=True)
(schemes/'DigitPro.xcscheme').write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.3">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{uid('target:DigitPro')}" BuildableName="DigitPro.app" BlueprintName="DigitPro" ReferencedContainer="container:DigitPro iOS.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction>
<LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{uid('target:DigitPro')}" BuildableName="DigitPro.app" BlueprintName="DigitPro" ReferencedContainer="container:DigitPro iOS.xcodeproj"/></BuildableProductRunnable></LaunchAction>
<AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>''')
print('Generated DigitPro iOS.xcodeproj (app + widget).')
