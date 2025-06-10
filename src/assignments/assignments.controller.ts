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

@Controller('assignments')
@UseGuards(JwtGuard)
@UseInterceptors(AddFullNameInterceptor)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post('bulk-reassign')
  async bulkReassign(@Body() body: BulkReassignDto, @Request() req: any) {
    const tenantName = req.user.tenantName;
    const userId = req.user?._id;
    const ourOfficeEmail = req.user?.email;

    return this.assignmentsService.bulkReassignProducts(
      body.items,
      userId,
      tenantName,
      ourOfficeEmail,
    );
  }
}
