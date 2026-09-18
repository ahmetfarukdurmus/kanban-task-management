package com.kanban.config;

import com.kanban.entity.*;
import com.kanban.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Initializes clean test user accounts, realistic banking scenario data (FinTech & Core Banking Solutions),
 * and dynamic workflow rules.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final OrganizationRepository           organizationRepository;
    private final UserRepository                   userRepository;
    private final TaskTypeRepository               taskTypeRepository;
    private final TaskTypeColumnRepository         taskTypeColumnRepository;
    private final TaskTypeTransitionRuleRepository taskTypeTransitionRuleRepository;
    private final BoardRepository                  boardRepository;
    private final BoardColumnRepository            boardColumnRepository;
    private final TaskRepository                   taskRepository;
    private final TaskChecklistItemRepository      taskChecklistItemRepository;
    private final TaskTypeFieldRepository          taskTypeFieldRepository;
    private final PasswordEncoder                  passwordEncoder;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Running DataInitializer for banking scenario seed data...");

        dropLegacyEnumCheckConstraints();

        // 1. Clean up legacy seed demo organizations if they exist
        List.of("Muhasebe", "Uyum & Risk").forEach(orgName -> {
            organizationRepository.findByName(orgName).ifPresent(org -> {
                // Delete associated boards
                var boards = boardRepository.findAllByOrganizationIdOrderByCreatedAtDesc(org.getId());
                boardRepository.deleteAll(boards);
                boardRepository.flush();

                // Detach members
                var members = userRepository.findAllByOrganizationIdOrderByUsernameAsc(org.getId());
                for (User member : members) {
                    member.getOrganizations().remove(org);
                    userRepository.save(member);
                }
                userRepository.flush();

                organizationRepository.delete(org);
                organizationRepository.flush();
                log.info("Removed legacy seed organization: {}", orgName);
            });
        });

        // 2. Clean up legacy demo users if they exist
        List.of(
                "muhasebe_admin",
                "uyum_admin",
                "ahmet_muhasebe",
                "mehmet_muhasebe",
                "yunus_uyum",
                "elif_uyum"
        ).forEach(demoUsername -> {
            userRepository.findByUsername(demoUsername).ifPresent(user -> {
                userRepository.delete(user);
                log.info("Removed legacy seed demo user: {}", demoUsername);
            });
        });

        // 3. Seed Organization: "FinTech & Core Banking Solutions"
        Organization fintechOrg = organizationRepository.findByName("FinTech & Core Banking Solutions")
                .orElseGet(() -> {
                    Organization org = Organization.builder()
                            .name("FinTech & Core Banking Solutions")
                            .description("Bankacılık ödeme geçidi, provizyon ve PCI-DSS standartlarına tabi çekirdek finans sistemleri.")
                            .build();
                    Organization saved = organizationRepository.save(org);
                    log.info("Created seed organization: {}", saved.getName());
                    return saved;
                });

        // 4. Seed Users: Super Admin & Bankacılık Ekip Üyeleri (All attached to FinTech Org)
        User superAdmin = seedUser("superadmin", "superadmin@fintech.local", "password123", Role.ROLE_SUPER_ADMIN, fintechOrg);
        User aliYilmaz = seedUser("ali.yilmaz", "ali.yilmaz@fintech.local", "password123", Role.ROLE_USER, fintechOrg);
        User zeynepKaya = seedUser("zeynep.kaya", "zeynep.kaya@fintech.local", "password123", Role.ROLE_USER, fintechOrg);
        User mehmetDemir = seedUser("mehmet.demir", "mehmet.demir@fintech.local", "password123", Role.ROLE_USER, fintechOrg);
        User ayseCelik = seedUser("ayse.celik", "ayse.celik@fintech.local", "password123", Role.ROLE_USER, fintechOrg);
        User burakOzkan = seedUser("burak.ozkan", "burak.ozkan@fintech.local", "password123", Role.ROLE_USER, fintechOrg);

        // Backward compatibility accounts
        seedUser("ali_yilmaz", "ali@kanban.local", "password123", Role.ROLE_USER, fintechOrg);
        seedUser("admin", "admin@kanban.local", "password123", Role.ROLE_SUPER_ADMIN, fintechOrg);

        // 5. Seed TaskType: "Kritik Ödeme Entegrasyonu"
        TaskType paymentTaskType = taskTypeRepository.findAllByOrganizationIdOrderByNameAsc(fintechOrg.getId())
                .stream()
                .filter(t -> t.getName().equalsIgnoreCase("Kritik Ödeme Entegrasyonu"))
                .findFirst()
                .orElseGet(() -> {
                    TaskType tt = TaskType.builder()
                            .name("Kritik Ödeme Entegrasyonu")
                            .taskPrefix("PAY")
                            .colorHex("#2563EB")
                            .requireTestDate(true)
                            .requireEnvironment(true)
                            .organization(fintechOrg)
                            .columns(new ArrayList<>())
                            .rules(new ArrayList<>())
                            .build();
                    TaskType savedTt = taskTypeRepository.save(tt);

                    TaskTypeColumn c1 = TaskTypeColumn.builder()
                            .title("Backlog / İsterler")
                            .colorHex("#64748B")
                            .position(0)
                            .taskType(savedTt)
                            .build();
                    TaskTypeColumn c2 = TaskTypeColumn.builder()
                            .title("Geliştirme")
                            .colorHex("#3B82F6")
                            .position(1)
                            .taskType(savedTt)
                            .build();
                    TaskTypeColumn c3 = TaskTypeColumn.builder()
                            .title("QA & Güvenlik Testi")
                            .colorHex("#F59E0B")
                            .position(2)
                            .taskType(savedTt)
                            .build();
                    TaskTypeColumn c4 = TaskTypeColumn.builder()
                            .title("Canlıya Alındı")
                            .colorHex("#10B981")
                            .position(3)
                            .taskType(savedTt)
                            .build();

                    c1 = taskTypeColumnRepository.save(c1);
                    c2 = taskTypeColumnRepository.save(c2);
                    c3 = taskTypeColumnRepository.save(c3);
                    c4 = taskTypeColumnRepository.save(c4);
                    savedTt.getColumns().addAll(List.of(c1, c2, c3, c4));

                    // Transition Rules (Transition Guards)
                    // 1. Geliştirme -> QA: CHECKLIST_REQUIRED ("Birim testler ve kod analizi tamamlandı.")
                    TaskTypeTransitionRule r1 = TaskTypeTransitionRule.builder()
                            .taskType(savedTt)
                            .sourceTaskTypeColumn(c2)
                            .targetTaskTypeColumn(c3)
                            .sourceColumnTitle("Geliştirme")
                            .targetColumnTitle("QA & Güvenlik Testi")
                            .ruleType(TransitionRuleType.CHECKLIST_REQUIRED)
                            .description("Birim testler ve kod analizi tamamlandı.")
                            .build();

                    // 2. QA -> Canlıya Alındı: CHECKLIST_REQUIRED ("Regresyon ve güvenlik test onayı alındı.")
                    TaskTypeTransitionRule r2 = TaskTypeTransitionRule.builder()
                            .taskType(savedTt)
                            .sourceTaskTypeColumn(c3)
                            .targetTaskTypeColumn(c4)
                            .sourceColumnTitle("QA & Güvenlik Testi")
                            .targetColumnTitle("Canlıya Alındı")
                            .ruleType(TransitionRuleType.CHECKLIST_REQUIRED)
                            .description("Regresyon ve güvenlik test onayı alındı.")
                            .build();

                    // 3. QA -> Canlıya Alındı: ATTACHMENT_REQUIRED ("Penetrasyon veya QA test raporu eklenmeli.")
                    TaskTypeTransitionRule r3 = TaskTypeTransitionRule.builder()
                            .taskType(savedTt)
                            .sourceTaskTypeColumn(c3)
                            .targetTaskTypeColumn(c4)
                            .sourceColumnTitle("QA & Güvenlik Testi")
                            .targetColumnTitle("Canlıya Alındı")
                            .ruleType(TransitionRuleType.ATTACHMENT_REQUIRED)
                            .description("Penetrasyon veya QA test raporu eklenmeli.")
                            .build();

                    taskTypeTransitionRuleRepository.saveAll(List.of(r1, r2, r3));
                    savedTt.getRules().addAll(List.of(r1, r2, r3));

                    log.info("Created TaskType '{}' with 4 columns and 3 transition rules", savedTt.getName());
                    return taskTypeRepository.save(savedTt);
                });

        // 6. Seed Board: "Ödeme Sistemleri Ana Board"
        boolean boardExists = boardRepository.findAllByOrganizationIdOrderByCreatedAtDesc(fintechOrg.getId())
                .stream()
                .anyMatch(b -> b.getName().equalsIgnoreCase("Ödeme Sistemleri Ana Board"));

        if (!boardExists) {
            Board board = Board.builder()
                    .name("Ödeme Sistemleri Ana Board")
                    .boardKey("PAY")
                    .description("FinTech & Core Banking Solutions ödeme ve provizyon iş akışları takip panosu.")
                    .boardType(BoardType.STANDARD)
                    .owner(superAdmin)
                    .organization(fintechOrg)
                    .taskType(paymentTaskType)
                    .columns(new ArrayList<>())
                    .build();
            Board savedBoard = boardRepository.save(board);

            // Columns matching TaskType stages
            BoardColumn colBacklog = BoardColumn.builder()
                    .title("Backlog / İsterler")
                    .colorHex("#64748B")
                    .position(0)
                    .board(savedBoard)
                    .tasks(new ArrayList<>())
                    .build();
            BoardColumn colDev = BoardColumn.builder()
                    .title("Geliştirme")
                    .colorHex("#3B82F6")
                    .position(1)
                    .board(savedBoard)
                    .tasks(new ArrayList<>())
                    .build();
            BoardColumn colQA = BoardColumn.builder()
                    .title("QA & Güvenlik Testi")
                    .colorHex("#F59E0B")
                    .position(2)
                    .board(savedBoard)
                    .tasks(new ArrayList<>())
                    .build();
            BoardColumn colDone = BoardColumn.builder()
                    .title("Canlıya Alındı")
                    .colorHex("#10B981")
                    .position(3)
                    .board(savedBoard)
                    .tasks(new ArrayList<>())
                    .build();

            colBacklog = boardColumnRepository.save(colBacklog);
            colDev = boardColumnRepository.save(colDev);
            colQA = boardColumnRepository.save(colQA);
            colDone = boardColumnRepository.save(colDone);

            savedBoard.getColumns().addAll(List.of(colBacklog, colDev, colQA, colDone));

            // 7. Seed Tasks
            // Task 1 (in Geliştirme)
            Task task1 = Task.builder()
                    .title("3D Secure 2.0 & POS Gateway Entegrasyonu")
                    .description("Mastercard ve Visa 3DS 2.0 protokol entegrasyonu, friction-less akış ve biometric authentication desteği.")
                    .priority(Task.Priority.HIGH)
                    .taskType(paymentTaskType)
                    .targetEnvironment("DEV")
                    .reporter(superAdmin)
                    .assignees(new HashSet<>(List.of(aliYilmaz)))
                    .position(0)
                    .column(colDev)
                    .checklistItems(new ArrayList<>())
                    .build();
            task1 = taskRepository.save(task1);

            TaskChecklistItem t1_item1 = TaskChecklistItem.builder()
                    .task(task1)
                    .title("Banka API sözleşmesi incelendi")
                    .isCompleted(true)
                    .build();
            TaskChecklistItem t1_item2 = TaskChecklistItem.builder()
                    .task(task1)
                    .title("Callback webhook uçları kodlandı")
                    .isCompleted(true)
                    .build();
            TaskChecklistItem t1_item3 = TaskChecklistItem.builder()
                    .task(task1)
                    .title("Birim testler yazıldı (Geliştirme için Zorunlu)")
                    .isCompleted(false)
                    .build();
            taskChecklistItemRepository.saveAll(List.of(t1_item1, t1_item2, t1_item3));

            // Task 2 (in QA & Güvenlik Testi)
            Task task2 = Task.builder()
                    .title("Idempotency Key & Çift Çekim Önleme Mekanizması")
                    .description("Dağıtık sistemlerde aynı işlem referansıyla gelen mükerrer ödeme isteklerini Redis lock ve DB constraint ile engelleme.")
                    .priority(Task.Priority.HIGH)
                    .taskType(paymentTaskType)
                    .targetEnvironment("TEST")
                    .testDueDate(LocalDate.of(2026, 9, 20))
                    .reporter(superAdmin)
                    .assignees(new HashSet<>(List.of(aliYilmaz, mehmetDemir)))
                    .position(0)
                    .column(colQA)
                    .checklistItems(new ArrayList<>())
                    .build();
            task2 = taskRepository.save(task2);

            TaskChecklistItem t2_item1 = TaskChecklistItem.builder()
                    .task(task2)
                    .title("Redis kilit mekanizması eklendi")
                    .isCompleted(true)
                    .build();
            TaskChecklistItem t2_item2 = TaskChecklistItem.builder()
                    .task(task2)
                    .title("Yük altında concurrency testleri yapıldı")
                    .isCompleted(true)
                    .build();
            TaskChecklistItem t2_item3 = TaskChecklistItem.builder()
                    .task(task2)
                    .title("QA onay imzası tamamlandı")
                    .isCompleted(false)
                    .build();
            taskChecklistItemRepository.saveAll(List.of(t2_item1, t2_item2, t2_item3));

            // Task 3 (in Canlıya Alındı)
            Task task3 = Task.builder()
                    .title("Hassas Kart Verilerinin Maskelenmesi (PCI-DSS)")
                    .description("Tüm audit ve uygulama loglarında PAN ve CVV2 bilgilerinin maskelenmesi ve key vault entegrasyonu.")
                    .priority(Task.Priority.HIGH)
                    .taskType(paymentTaskType)
                    .targetEnvironment("PROD")
                    .reporter(superAdmin)
                    .assignees(new HashSet<>(List.of(ayseCelik)))
                    .position(0)
                    .column(colDone)
                    .checklistItems(new ArrayList<>())
                    .build();
            task3 = taskRepository.save(task3);

            TaskChecklistItem t3_item1 = TaskChecklistItem.builder()
                    .task(task3)
                    .title("Loglarda PAN/CVV maskeleme filtresi devrede")
                    .isCompleted(true)
                    .build();
            TaskChecklistItem t3_item2 = TaskChecklistItem.builder()
                    .task(task3)
                    .title("Güvenlik taraması raporlandı")
                    .isCompleted(true)
                    .build();
            taskChecklistItemRepository.saveAll(List.of(t3_item1, t3_item2));

            log.info("Created Banking Board '{}' with 3 tasks and checklist items", savedBoard.getName());
        }

        // 8. Ensure Internship Task Type exists & Auto-link unlinked boards (e.g. "kanban task management")
        TaskType internshipTaskType = taskTypeRepository.findAll().stream()
                .filter(t -> t.getName().toLowerCase().contains("internship") || t.getName().toLowerCase().contains("staj"))
                .findFirst()
                .orElseGet(() -> {
                    TaskType tt = TaskType.builder()
                            .name("internship task")
                            .taskPrefix("INT")
                            .colorHex("#EF4444")
                            .organization(fintechOrg)
                            .columns(new ArrayList<>())
                            .rules(new ArrayList<>())
                            .fields(new ArrayList<>())
                            .build();
                    TaskType saved = taskTypeRepository.save(tt);
                    log.info("Created Internship TaskType with color #EF4444 and prefix INT");
                    return saved;
                });

        // 9. Seed TaskType: "Firewall & Ağ Kural Tanımı" with dynamic custom input fields
        taskTypeRepository.findAllByOrganizationIdOrderByNameAsc(fintechOrg.getId()).stream()
                .filter(t -> t.getName().equalsIgnoreCase("Firewall & Ağ Kural Tanımı"))
                .findFirst()
                .orElseGet(() -> {
                    TaskType fwType = TaskType.builder()
                            .name("Firewall & Ağ Kural Tanımı")
                            .taskPrefix("FW")
                            .colorHex("#8B5CF6")
                            .requireTestDate(false)
                            .requireEnvironment(true)
                            .organization(fintechOrg)
                            .columns(new ArrayList<>())
                            .rules(new ArrayList<>())
                            .fields(new ArrayList<>())
                            .build();
                    TaskType savedFw = taskTypeRepository.save(fwType);

                    // Workflow Columns
                    TaskTypeColumn fc1 = TaskTypeColumn.builder().title("Talep Açıldı").colorHex("#64748B").position(0).taskType(savedFw).build();
                    TaskTypeColumn fc2 = TaskTypeColumn.builder().title("Güvenlik Onayı").colorHex("#F59E0B").position(1).taskType(savedFw).build();
                    TaskTypeColumn fc3 = TaskTypeColumn.builder().title("Kural Uygulandı").colorHex("#3B82F6").position(2).taskType(savedFw).build();
                    TaskTypeColumn fc4 = TaskTypeColumn.builder().title("Doğrulandı & Aktif").colorHex("#10B981").position(3).taskType(savedFw).build();
                    taskTypeColumnRepository.saveAll(List.of(fc1, fc2, fc3, fc4));
                    savedFw.getColumns().addAll(List.of(fc1, fc2, fc3, fc4));

                    // Dynamic Custom Fields
                    TaskTypeField f1 = TaskTypeField.builder()
                            .taskType(savedFw)
                            .fieldName("Kaynak IP / Host (Source)")
                            .fieldType(TaskTypeField.FieldType.TEXT)
                            .required(true)
                            .placeholder("Örn: 10.200.1.50 veya sub-network")
                            .position(0)
                            .build();

                    TaskTypeField f2 = TaskTypeField.builder()
                            .taskType(savedFw)
                            .fieldName("Hedef URL / IP (Target)")
                            .fieldType(TaskTypeField.FieldType.TEXT)
                            .required(true)
                            .placeholder("Örn: 192.168.1.100 veya https://api.banka.com")
                            .position(1)
                            .build();

                    TaskTypeField f3 = TaskTypeField.builder()
                            .taskType(savedFw)
                            .fieldName("Sunucu / Makine Bilgisi")
                            .fieldType(TaskTypeField.FieldType.TEXT)
                            .required(true)
                            .placeholder("Örn: srv-prod-gateway-01 / Core-DB")
                            .position(2)
                            .build();

                    TaskTypeField f4 = TaskTypeField.builder()
                            .taskType(savedFw)
                            .fieldName("Port & Protokol")
                            .fieldType(TaskTypeField.FieldType.CASCADING_SELECT)
                            .required(false)
                            .options("{\"parentLabel\":\"Port Grubu\",\"childLabel\":\"Alt Port / Protokol\",\"parentOptions\":[\"1000\",\"2000\",\"3000\"],\"childOptions\":{\"1000\":[\"1001\",\"1002\",\"1003\"],\"2000\":[\"2001\",\"2002\",\"2003\"],\"3000\":[\"3001\",\"3002\",\"3003\"]}}")
                            .placeholder("Port grubunu seçiniz")
                            .position(3)
                            .build();

                    TaskTypeField f5 = TaskTypeField.builder()
                            .taskType(savedFw)
                            .fieldName("Trafik Yönü")
                            .fieldType(TaskTypeField.FieldType.SELECT)
                            .required(true)
                            .options("Giriş (Inbound), Çıkış (Outbound), Çift Yönlü (Bidirectional)")
                            .placeholder("Trafik yönünü seçiniz")
                            .position(4)
                            .build();

                    taskTypeFieldRepository.saveAll(List.of(f1, f2, f3, f4, f5));
                    savedFw.getFields().addAll(List.of(f1, f2, f3, f4, f5));

                    log.info("Created Firewall & Ağ Kural Tanımı TaskType with 5 dynamic custom fields and prefix FW");
                    return taskTypeRepository.save(savedFw);
                });

        // 10. Synchronize and backfill taskPrefix for all task types
        taskTypeRepository.findAll().forEach(tt -> {
            String derivedPrefix = com.kanban.service.TaskTypeService.derivePrefix(tt.getName(), tt.getTaskPrefix());
            tt.setTaskPrefix(derivedPrefix);
            taskTypeRepository.save(tt);
            log.info("Synchronized TaskType '{}' with prefix: {}", tt.getName(), derivedPrefix);
        });
        taskTypeRepository.flush();

        // 11. Auto-link boards, set boardKey and backfill/sync taskKey for tasks
        boardRepository.findAll().forEach(b -> {
            if (b.getTaskType() == null) {
                if (b.getName() != null && (b.getName().toLowerCase().contains("kanban") || b.getName().toLowerCase().contains("intern") || b.getName().toLowerCase().contains("staj"))) {
                    b.setTaskType(internshipTaskType);
                } else if (b.getName() != null && (b.getName().toLowerCase().contains("firewall") || b.getName().toLowerCase().contains("ag") || b.getName().toLowerCase().contains("fw"))) {
                    TaskType fw = taskTypeRepository.findAll().stream().filter(t -> t.getName().contains("Firewall")).findFirst().orElse(paymentTaskType);
                    b.setTaskType(fw);
                } else {
                    b.setTaskType(paymentTaskType);
                }
            }

            // Ensure boardKey is set and accurate
            String bName = b.getName() != null ? b.getName().toLowerCase() : "";
            String tName = b.getTaskType() != null && b.getTaskType().getName() != null ? b.getTaskType().getName().toLowerCase() : "";

            String key;
            if (bName.contains("firewall") || bName.contains("ag") || bName.contains("fw") || tName.contains("firewall") || tName.contains("ag")) {
                key = "FW";
            } else if (bName.contains("odeme") || bName.contains("payment") || bName.contains("pay") || tName.contains("odeme") || tName.contains("payment")) {
                key = "PAY";
            } else if (bName.contains("dev") || bName.contains("gelistirme") || tName.contains("dev") || tName.contains("gelistirme")) {
                key = "DEV";
            } else if (bName.contains("sizma") || bName.contains("sec") || bName.contains("guvenlik") || tName.contains("sizma") || tName.contains("sec")) {
                key = "SEC";
            } else if (bName.contains("intern") || bName.contains("staj") || tName.contains("intern") || tName.contains("staj")) {
                key = "INT";
            } else if (b.getTaskType() != null && b.getTaskType().getTaskPrefix() != null && !b.getTaskType().getTaskPrefix().isBlank()) {
                key = b.getTaskType().getTaskPrefix();
            } else {
                key = com.kanban.service.TaskTypeService.derivePrefix(b.getName(), b.getBoardKey());
            }

            b.setBoardKey(key);
            boardRepository.save(b);
            log.info("Synchronized Board '{}' with boardKey: {}", b.getName(), key);
        });
        boardRepository.flush();

        taskRepository.findAll().forEach(t -> {
            if (t.getTaskType() == null && t.getColumn() != null && t.getColumn().getBoard() != null && t.getColumn().getBoard().getTaskType() != null) {
                t.setTaskType(t.getColumn().getBoard().getTaskType());
            }
            Board b = t.getColumn() != null ? t.getColumn().getBoard() : null;
            TaskType effectiveType = t.getTaskType() != null ? t.getTaskType() : (b != null ? b.getTaskType() : null);
            String keyPrefix = (effectiveType != null && effectiveType.getTaskPrefix() != null && !effectiveType.getTaskPrefix().isBlank())
                    ? effectiveType.getTaskPrefix()
                    : (effectiveType != null ? com.kanban.service.TaskTypeService.derivePrefix(effectiveType.getName(), null)
                    : (b != null && b.getBoardKey() != null && !b.getBoardKey().isBlank() && !"BOARD".equalsIgnoreCase(b.getBoardKey())
                            ? b.getBoardKey()
                            : (b != null ? com.kanban.service.TaskTypeService.derivePrefix(b.getName(), null) : "TASK")));

            String correctKey = keyPrefix + "-" + t.getId();
            t.setTaskKey(correctKey);
            taskRepository.save(t);
            log.debug("Synchronized Task ID {} -> taskKey: {}", t.getId(), correctKey);
        });
        taskRepository.flush();

        // 12. Synchronize and guarantee Cascading Select for Port fields
        String cascadingPortOptions = "{\"parentLabel\":\"Ana Port Grubu\",\"childLabel\":\"Port Numarası\",\"parentOptions\":[\"1000\",\"2000\",\"3000\"],\"childOptions\":{\"1000\":[\"1001\",\"1002\",\"1003\"],\"2000\":[\"2001\",\"2002\",\"2003\"],\"3000\":[\"3001\",\"3002\",\"3003\"]}}";

        taskTypeFieldRepository.findAll().forEach(f -> {
            String name = f.getFieldName() != null ? f.getFieldName().toLowerCase() : "";
            if (name.contains("port")) {
                f.setFieldName("Port Bilgisi");
                f.setFieldType(TaskTypeField.FieldType.CASCADING_SELECT);
                f.setOptions(cascadingPortOptions);
                f.setPlaceholder("Port grubu seçin");
                taskTypeFieldRepository.save(f);
                log.info("Synchronized TaskTypeField id={} to CASCADING_SELECT with 1000, 2000, 3000 port groups", f.getId());
            }
        });
        taskTypeFieldRepository.flush();

        // Ensure Firewall TaskType has the Port Bilgisi field
        taskTypeRepository.findAll().stream()
                .filter(tt -> tt.getName() != null && (tt.getName().toLowerCase().contains("firewall") || tt.getName().toLowerCase().contains("ag") || "FW".equalsIgnoreCase(tt.getTaskPrefix())))
                .forEach(fw -> {
                    boolean hasPortField = fw.getFields() != null && fw.getFields().stream().anyMatch(f -> f.getFieldName() != null && f.getFieldName().toLowerCase().contains("port"));
                    if (!hasPortField) {
                        TaskTypeField portField = TaskTypeField.builder()
                                .taskType(fw)
                                .fieldName("Port Bilgisi")
                                .fieldType(TaskTypeField.FieldType.CASCADING_SELECT)
                                .required(false)
                                .options(cascadingPortOptions)
                                .placeholder("Port grubu seçin")
                                .position(3)
                                .build();
                        taskTypeFieldRepository.save(portField);
                        if (fw.getFields() == null) fw.setFields(new ArrayList<>());
                        fw.getFields().add(portField);
                        taskTypeRepository.save(fw);
                    }
                });

        // Ensure all tasks associated with FW or port fields have custom field values
        taskRepository.findAll().forEach(t -> {
            if (t.getCustomFields() != null) {
                for (TaskCustomField cf : t.getCustomFields()) {
                    if (cf.getFieldName() != null && cf.getFieldName().toLowerCase().contains("port")) {
                        cf.setFieldName("Port Bilgisi");
                        cf.setFieldType(TaskCustomField.FieldType.CASCADING_SELECT);
                        if (cf.getFieldValue() == null || cf.getFieldValue().isBlank()) {
                            cf.setFieldValue("1001");
                        }
                    }
                }
                taskRepository.save(t);
            }
        });
        taskRepository.flush();

        log.info("DataInitializer completed: Banking scenario seed data is ready.");
    }

    private User seedUser(String username, String email, String rawPassword, Role role, Organization organization) {
        return userRepository.findByUsername(username).map(existing -> {
            existing.setEmail(email);
            existing.setPassword(passwordEncoder.encode(rawPassword));
            existing.setRole(role);
            if (organization != null) {
                if (existing.getOrganizations() == null) {
                    existing.setOrganizations(new HashSet<>());
                }
                existing.getOrganizations().add(organization);
            }
            return userRepository.save(existing);
        }).orElseGet(() -> {
            Set<Organization> orgs = new HashSet<>();
            if (organization != null) {
                orgs.add(organization);
            }
            User newUser = User.builder()
                    .username(username)
                    .email(email)
                    .password(passwordEncoder.encode(rawPassword))
                    .role(role)
                    .organizations(orgs)
                    .build();
            User saved = userRepository.save(newUser);
            log.info("Created seed user: {} ({}) with organization: {}", username, role, organization != null ? organization.getName() : "None");
            return saved;
        });
    }

    private void dropLegacyEnumCheckConstraints() {
        log.info("Dropping legacy PostgreSQL check constraints on enum fields if present...");
        List<String> dropStatements = List.of(
            "ALTER TABLE IF EXISTS task_custom_fields DROP CONSTRAINT IF EXISTS task_custom_fields_field_type_check",
            "ALTER TABLE IF EXISTS task_type_fields DROP CONSTRAINT IF EXISTS task_type_fields_field_type_check",
            "ALTER TABLE IF EXISTS boards DROP CONSTRAINT IF EXISTS boards_board_type_check",
            "ALTER TABLE IF EXISTS tasks DROP CONSTRAINT IF EXISTS tasks_priority_check",
            "ALTER TABLE IF EXISTS task_activities DROP CONSTRAINT IF EXISTS task_activities_activity_type_check",
            "ALTER TABLE IF EXISTS task_type_transition_rules DROP CONSTRAINT IF EXISTS task_type_transition_rules_rule_type_check",
            "ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_role_check"
        );

        for (String sql : dropStatements) {
            try {
                jdbcTemplate.execute(sql);
            } catch (Exception e) {
                log.warn("Could not execute DDL constraint drop (harmless if not on PostgreSQL or constraint does not exist): {} - {}", sql, e.getMessage());
            }
        }
    }
}
