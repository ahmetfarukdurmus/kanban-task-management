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
    private final PasswordEncoder                  passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Running DataInitializer for banking scenario seed data...");

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
                            .colorHex("#EF4444")
                            .organization(fintechOrg)
                            .columns(new ArrayList<>())
                            .rules(new ArrayList<>())
                            .build();
                    TaskType saved = taskTypeRepository.save(tt);
                    log.info("Created Internship TaskType with color #EF4444");
                    return saved;
                });

        boardRepository.findAll().forEach(b -> {
            if (b.getTaskType() == null) {
                if (b.getName() != null && (b.getName().toLowerCase().contains("kanban") || b.getName().toLowerCase().contains("intern") || b.getName().toLowerCase().contains("staj"))) {
                    b.setTaskType(internshipTaskType);
                    boardRepository.save(b);
                    log.info("Auto-linked board '{}' to TaskType '{}' ({})", b.getName(), internshipTaskType.getName(), internshipTaskType.getColorHex());
                } else {
                    b.setTaskType(paymentTaskType);
                    boardRepository.save(b);
                    log.info("Auto-linked board '{}' to default TaskType '{}' ({})", b.getName(), paymentTaskType.getName(), paymentTaskType.getColorHex());
                }
            }
        });

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
}
