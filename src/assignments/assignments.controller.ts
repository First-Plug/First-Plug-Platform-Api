import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  Body,
  Request,
} from '@nestjs/common';
import { AssignmentsService } from 'src/assignments/assignments.service';
import { BulkReassignDto } from 'src/assignments/dto/bulk-reassign.dto';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { AddFullNameInterceptor } from 'src/members/interceptors/add-full-name.interceptor';

@Controller('assigments')
@UseGuards(JwtGuard)
@UseInterceptors(AddFullNameInterceptor)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post('bulk-reassign')
  async bulkReassign(@Body() body: BulkReassignDto, @Request() req: any) {
    console.log('🧾 User:', req.user);
    console.log('bulk-reassign → body:', JSON.stringify(body, null, 2));
    const tenantName = req.user.tenantName;
    const userId = req.user.userId;
    const ourOfficeEmail = req.user.email;

    return this.assignmentsService.bulkReassignProducts(
      body.items,
      userId,
      tenantName,
      ourOfficeEmail,
    );
  }
}
